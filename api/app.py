import os
import re
import pdfplumber
import threading
import time
from flask import Flask, request, send_from_directory
from google import genai
from google.genai import types
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS

class GeminiEmbeddings:
    def __init__(self, api_key):
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-embedding-001"

    def embed_documents(self, texts):
        all_embeddings = []

        batch_size = 50

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            print(f"Embedding chunks {i + 1}-{i + len(batch)} dari {len(texts)}")

            result = self.client.models.embed_content(
                model=self.model,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=768
                )
            )

            all_embeddings.extend([e.values for e in result.embeddings])

            # Tunggu sebelum batch berikutnya
            if i + batch_size < len(texts):
                print("Menunggu 65 detik sebelum batch berikutnya...")
                time.sleep(65)

        return all_embeddings

    def embed_query(self, text):
        result = self.client.models.embed_content(
            model=self.model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=768
            )
        )
        return result.embeddings[0].values

    def __call__(self, text):
        return self.embed_query(text)


app = Flask(__name__)

@app.route("/")
def home():
    return send_from_directory("../public", "index.html")

# ==============================================================================
# RETRIEVE API KEY FROM GOOGLE COLAB SECRETS
# ==============================================================================

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

#try:
#    COLAB_GEMINI_API_KEY = userdata.get('GEMINI_API_KEY')
#    print("✅ GEMINI_API_KEY berhasil dimuat dari Google Colab Secrets!")
#except Exception as e:
#    COLAB_GEMINI_API_KEY = None
#    print("⚠️ GEMINI_API_KEY tidak ditemukan di Colab Secrets. Pastikan Anda telah menambahkan key 'GEMINI_API_KEY' di ikon kunci 🔑 Colab.")

# ==============================================================================
# GLOBAL VARIABLES FOR VECTOR STORE & EMBEDDING MODEL
# ==============================================================================
vector_store = None
embedding_model = None
processing_status = "idle"
processing_result = ""

# ==============================================================================
# TAHAP 1: DATA INGESTION & DATA CLEANING
# ==============================================================================
def clean_text(text):
    """Pembersihan teks dari header/footer, simbol aneh, dan spasi berlebih."""
    if not text:
        return ""
    text = re.sub(r'Halaman\s+\d+(\s+dari\s+\d+)?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'[^\w\s.,?!:;\-()/"\'%-]', ' ', text)
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return " ".join(lines)

def process_pdf_files(rps_file, modul_file):
    """Ekstraksi teks dari file RPS dan Modul ke format Document LangChain."""
    global vector_store, embedding_model

    if not rps_file or not modul_file:
        return "⚠️ Harap unggah KEDUA dokumen (RPS dan Modul Perkuliahan) terlebih dahulu!"

    all_documents = []
    files_to_process = [("RPS", rps_file), ("Modul", modul_file)]

    for doc_type, file_obj in files_to_process:
        #file_path = file_obj.name
        #file_name = os.path.basename(file_path)

        #with pdfplumber.open(file_path) as pdf:
        with pdfplumber.open(file_obj) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):

                raw_text = page.extract_text()
                cleaned_text = clean_text(raw_text)

                if cleaned_text:
                    doc = Document(
                        page_content=cleaned_text,
                        metadata={
                            "doc_type": doc_type,
                            "source": file_obj.filename,
                            "page": page_num
                        }
                    )
                    all_documents.append(doc)

    # ==============================================================================
    # TAHAP 2: CHUNKING & EMBEDDING
    # ==============================================================================
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    chunks = text_splitter.split_documents(all_documents)

    # Memuat Embedding Model

    # Memuat Gemini Embedding Model
    if embedding_model is None:
        embedding_model = GeminiEmbeddings(GEMINI_API_KEY)

    #if embedding_model is None:
    #    embedding_model = HuggingFaceEmbeddings(
    #        model_name="intfloat/multilingual-e5-base",
    #        model_kwargs={'device': 'cpu'},
    #        encode_kwargs={'normalize_embeddings': True}
    #    )

    # ==============================================================================
    # TAHAP 3: VECTOR DATABASE INDEXING (FAISS)
    # ==============================================================================
    print("DEBUG: mulai FAISS.from_documents()", flush=True)

    vector_store = FAISS.from_documents(chunks, embedding_model)
    
    print("DEBUG: FAISS.from_documents() SELESAI", flush=True)

    return f"✅ Berhasil memproses dokumen!\n- Total Dokumen Ingesti: {len(all_documents)} halaman\n- Total Chunks Diindeks: {len(chunks)} segmen ke FAISS VectorDB."

# ==============================================================================
# TAHAP 4 & 5: RETRIEVAL & CONTROLLED GENERATION (AUTOMATIC COLAB SECRETS KEY)
# ==============================================================================
def generate_quiz(topic_query, num_questions, question_format, bloom_level):
    global vector_store, GEMINI_API_KEY

    # Verifikasi API Key dari Google Colab Secrets
    if not GEMINI_API_KEY:
        return "⚠️ API Key tidak ditemukan!"
    if vector_store is None:
        return "⚠️ Harap unggah dan proses dokumen RPS & Modul terlebih dahulu pada Tab 1!"
    if not topic_query.strip():
        return "⚠️ Harap masukkan topik perkuliahan yang ingin dibuatkan soal!"

    # 1. Konfigurasi Client Gemini SDK Terbaru menggunakan API Key tersimpan
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        return f"Error konfigurasi Gemini API Client: {str(e)}"

    # 2. DETEKSI OTOMATIS MODEL GEMINI YANG AKTIF#
    active_models = ["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash"]

    print(f"Model generasi yang akan dicoba: {active_models}")

    # TAHAP 4: RETRIEVAL COMPONENT (Search Cosine Similarity)
    retrieved_docs = vector_store.similarity_search(topic_query, k=5)

    context_text = ""
    for doc in retrieved_docs:
        context_text += f"\n--- [Sumber: {doc.metadata['doc_type']} | Halaman: {doc.metadata['page']}] ---\n{doc.page_content}\n"

    # Mapping Deskripsi Taksonomi Bloom
    bloom_desc = {
        "Mudah (C1-C2)": "C1 (Remembering/Mengingat) dan C2 (Understanding/Memahami). Soal berfokus pada definisi, konsep dasar, dan pemahaman faktual.",
        "Sedang (C3-C4)": "C3 (Applying/Menerapkan) dan C4 (Analyzing/Menganalisis). Soal berfokus pada studi kasus, penerapan rumus/konsep, serta analisis hubungan antar konsep.",
        "Sukar (C5-C6)": "C5 (Evaluating/Mengevaluasi) dan C6 (Creating/Menciptakan). Soal berfokus pada penilaian kritis, pemecahan masalah kompleks, serta merancang solusi/ide baru."
    }

    # TAHAP 5: CONTROLLED GENERATION (Prompt Engineering Adaptif)
    prompt_template = f"""
    Anda adalah seorang dosen dan pakar evaluasi akademik di perguruan tinggi.

    Tugas Anda adalah membuat soal evaluasi mahasiswa berdasarkan materi
    perkuliahan yang terdapat pada KONTEKS TEKS RUJUKAN.

    ==================================================
    ATURAN SUMBER INFORMASI
    ==================================================

    1. Gunakan HANYA informasi yang terdapat dalam KONTEKS TEKS RUJUKAN.
    2. MODUL adalah sumber UTAMA untuk isi dan konsep yang digunakan dalam soal.
    3. RPS digunakan terutama untuk menentukan CAKUPAN materi yang memang
      harus dipelajari mahasiswa.
    4. Jangan menjadikan RPS sebagai objek hafalan.

    DILARANG membuat soal yang hanya menguji:
    - nomor halaman
    - nomor atau isi pertemuan
    - nama penulis
    - judul buku
    - daftar pustaka
    - sumber referensi
    - metadata dokumen
    - struktur RPS
    - nama mata kuliah
    - bagian-bagian administratif RPS
    - lokasi suatu informasi di dalam dokumen

    Contoh soal yang SALAH:
    "Pada halaman 6 Modul, apa yang dimaksud dengan ...?"

    "Siapa penulis buku yang tercantum pada RPS?"

    "Pada pertemuan ke berapa materi X dibahas?"

    Soal harus tetap dapat dijawab mahasiswa berdasarkan
    PEMAHAMAN MATERI, bukan berdasarkan kemampuan mencari informasi
    di dalam dokumen.

    ==================================================
    KONTEKS TEKS RUJUKAN
    ==================================================

    {context_text}

    ==================================================
    PARAMETER PENYUSUNAN SOAL
    ==================================================

    Topik Materi:
    {topic_query}

    Jumlah Soal:
    {num_questions}

    Format Soal:
    {question_format}

    Tingkat Kesulitan:
    {bloom_level}

    ==================================================
    ATURAN TAKSONOMI BLOOM
    ==================================================

    Jika tingkat kesulitan adalah Mudah (C1-C2):

    Fokus pada:
    - mengingat konsep
    - menjelaskan pengertian
    - mengidentifikasi konsep
    - memahami hubungan sederhana antar konsep

    Jika tingkat kesulitan adalah Sedang (C3-C4):

    C3 (Applying):
    - berikan situasi, kasus, contoh, atau kondisi tertentu
    - minta mahasiswa MENERAPKAN konsep yang dipelajari
    - mahasiswa harus menggunakan konsep untuk menentukan tindakan,
      solusi, penerapan, atau interpretasi yang tepat

    C4 (Analyzing):
    - berikan kasus, situasi, pernyataan, atau beberapa informasi
    - minta mahasiswa MENGANALISIS informasi tersebut
    - mahasiswa dapat diminta membandingkan konsep
    - menemukan hubungan sebab-akibat
    - mengidentifikasi alasan
    - menganalisis hubungan antar konsep
    - menentukan konsep yang paling tepat berdasarkan suatu kasus

    PENTING:
    Jangan hanya menambahkan kata "berdasarkan kasus" pada soal
    hafalan.

    Soal C3/C4 harus benar-benar membutuhkan penerapan atau analisis
    konsep untuk mendapatkan jawaban.

    Jika tingkat kesulitan adalah Sukar (C5-C6):

    Fokus pada:
    - mengevaluasi suatu keputusan atau argumen
    - menilai solusi
    - memecahkan masalah yang lebih kompleks
    - merancang solusi berdasarkan konsep yang tersedia dalam konteks

    ==================================================
    FORMAT OUTPUT
    ==================================================

    Jika Format "Pilihan Ganda":

    Untuk setiap soal:
    - tuliskan pertanyaan
    - berikan 4 pilihan jawaban A, B, C, D
    - hanya satu jawaban yang benar
    - sertakan Kunci Jawaban
    - sertakan Pembahasan Singkat

    Jika Format "Esai":

    Untuk setiap soal:
    - tuliskan pertanyaan
    - sertakan Kunci Jawaban Acuan
    - sertakan Rubrik Penilaian

    ==================================================
    ATURAN KUALITAS
    ==================================================

    - Jangan membuat pertanyaan tentang metadata dokumen.
    - Jangan menyebut nomor halaman dalam pertanyaan.
    - Jangan bertanya tentang daftar pustaka.
    - Jangan bertanya tentang nama penulis atau judul buku kecuali
      informasi tersebut memang merupakan bagian dari konsep materi
      yang sedang dipelajari.
    - Utamakan konsep dan isi materi.
    - Untuk C3-C4, utamakan kasus atau situasi nyata/hipotetis.
    - Setiap jawaban harus dapat dibuktikan dari konteks yang diberikan.
    - Jangan menggunakan pengetahuan di luar konteks.
    - Jangan membuat soal yang jawabannya bergantung pada informasi
      yang tidak tersedia dalam konteks.

    Sajikan output secara rapi, profesional, dan terstruktur.
    """

    # Eksekusi pemanggilan model berdasarkan hasil deteksi otomatis
    last_error = ""
    for model_name in active_models:
        try:
            print(f"Mencoba generasi soal menggunakan model: {model_name} ...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt_template
            )
            return response.text
        except Exception as e:
            last_error = str(e)
            print(f"Model {model_name} gagal/limit: {last_error}")
            continue

    return f"⚠️ Gagal melakukan generasi soal.\n\nDetail Error Terakhir: {last_error}\n\n💡 Saran: Jika error menunjukkan 'RESOURCE_EXHAUSTED' (429), silakan tunggu 1 menit."


@app.route("/process", methods=["POST"])
def process():
    global processing_status, processing_result

    rps_file = request.files.get("rps")
    modul_file = request.files.get("modul")

    if not rps_file or not modul_file:
        return "RPS dan Modul wajib diupload.", 400

    if processing_status == "processing":
        return "Proses sebelumnya masih berjalan.", 409

    # Simpan isi file ke memory sebelum background thread dimulai
    rps_data = rps_file.read()
    modul_data = modul_file.read()

    processing_status = "processing"
    processing_result = ""

    def background_process():
        global processing_status, processing_result
    
        try:
            from io import BytesIO
    
            rps_copy = BytesIO(rps_data)
            modul_copy = BytesIO(modul_data)
    
            rps_copy.filename = "RPS.pdf"
            modul_copy.filename = "Modul.pdf"
    
            processing_result = process_pdf_files(
                rps_copy,
                modul_copy
            )
    
            processing_status = "completed"
    
        except Exception as e:
            processing_result = str(e)
            processing_status = "error"

    thread = threading.Thread(target=background_process)
    thread.start()

    return "processing", 202

@app.route("/status", methods=["GET"])
def status():
    return {
        "status": processing_status,
        "result": processing_result
    }

@app.route("/generate", methods=["POST"])
def generate():

    topic_query = request.form.get("topic")
    num_questions = request.form.get("num_questions", type=int)
    question_format = request.form.get("question_format")
    bloom_level = request.form.get("bloom_level")

    result = generate_quiz(
        topic_query,
        num_questions,
        question_format,
        bloom_level
    )

    return result

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000
    )

# ==============================================================================
# GRADIO INTERFACE BUILDER
# ==============================================================================
#with gr.Blocks(title="Generator Soal Cerdas Berbasis RAG", theme=gr.themes.Soft()) as demo:
#    gr.Markdown(
#        """
#        # 🎓 Generator Soal Cerdas Berbasis RAG (Retrieval-Augmented Generation)
#        **Otomatisasi Evaluasi Mahasiswa Terintegrasi RPS dan Modul Perkuliahan**
#        """
#    )
#
#    with gr.Tab("📁 Tab 1: Ingesti & Indeks Dokumen"):
#        gr.Markdown("### Unggah Dokumen Akademik (PDF)")
#        with gr.Row():
#            rps_input = gr.File(label="Upload PDF RPS (Rencana Pembelajaran Semester)", file_types=[".pdf"])
#            modul_input = gr.File(label="Upload PDF Modul Perkuliahan", file_types=[".pdf"])
#
#        process_btn = gr.Button("🚀 Proses & Indeks Dokumen (FAISS)", variant="primary")
#        status_output = gr.Textbox(label="Status Ingesti Data", interactive=False, lines=4)
#
#        process_btn.click(
#            fn=process_pdf_files,
#            inputs=[rps_input, modul_input],
#            outputs=status_output
#        )
#
#    with gr.Tab("⚙️ Tab 2: Generator Soal"):
#        gr.Markdown("### Parameter Kontrol Pembuatan Kuis")
#
#        # Kolom input API Key telah dihapus dari antarmuka Gradio
#        with gr.Row():
#            topic_input = gr.Textbox(
#                label="Topik / Sub-Capaian Perkuliahan",
#                placeholder="Contoh: Konsep Dasar Database Relasional / Network Security",
#                scale=2
#            )
#            num_input = gr.Slider(minimum=1, maximum=10, step=1, value=3, label="Jumlah Soal")
#
#        with gr.Row():
#            format_input = gr.Radio(
#                choices=["Pilihan Ganda", "Esai"],
#                value="Pilihan Ganda",
#                label="Format Soal"
#            )
#            bloom_input = gr.Dropdown(
#                choices=["Mudah (C1-C2)", "Sedang (C3-C4)", "Sukar (C5-C6)"],
#                value="Sedang (C3-C4)",
#                label="Tingkat Kesulitan (Taksonomi Bloom)"
#            )
#
#        generate_btn = gr.Button("✨ Buat Soal Anda", variant="primary")
#        quiz_output = gr.Markdown(label="Hasil Generasi Soal")
#
#        generate_btn.click(
#            fn=generate_quiz,
#            inputs=[topic_input, num_input, format_input, bloom_input], # API Key disembunyikan & dibaca otomatis
#            outputs=quiz_output
#        )
#
# ==============================================================================
# LAUNCH GRADIO APP
# ==============================================================================
#if __name__ == "__main__":
#    demo.launch(debug=True, share=True)

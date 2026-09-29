
// =========================================================
// DOM ELEMENTS
// =========================================================

const generateButton = document.getElementById("generateButton");
const btnText = document.getElementById("btnText");
const btnIcon = document.getElementById("btnIcon");

const rpsInput = document.getElementById("rps");
const modulInput = document.getElementById("modul");

const rpsDropzone = document.getElementById("rps_dropzone");
const modulDropzone = document.getElementById("modul_dropzone");

const rpsFilename = document.getElementById("rps_filename");
const modulFilename = document.getElementById("modul_filename");

const rpsFilesize = document.getElementById("rps_filesize");
const modulFilesize = document.getElementById("modul_filesize");

const rpsClear = document.getElementById("rps_clear");
const modulClear = document.getElementById("modul_clear");

const topicInput = document.getElementById("topic");
const numQuestionsInput = document.getElementById("num_questions");
const questionFormatInput = document.getElementById("question_format");
const bloomLevelInput = document.getElementById("bloom_level");

const statusContainer = document.getElementById("statusContainer");
const statusElement = document.getElementById("status");
const statusIcon = document.getElementById("statusIcon");

const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const loadingStepTitle = document.getElementById("loadingStepTitle");
const loadingStepDesc = document.getElementById("loadingStepDesc");
const progressBar = document.getElementById("progressBar");

const resultWrapper = document.getElementById("resultWrapper");
const resultElement = document.getElementById("result");

const resultBadge = document.getElementById("resultBadge");
const charCount = document.getElementById("charCount");

const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const pdfBtn = document.getElementById("pdfBtn");
const clearBtn = document.getElementById("clearBtn");

const btnMinus = document.getElementById("btn_minus");
const btnPlus = document.getElementById("btn_plus");


// =========================================================
// FORMAT FILE SIZE
// =========================================================

function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat(
        (bytes / Math.pow(k, i)).toFixed(2)
    ) + " " + sizes[i];
}


// =========================================================
// ESCAPE HTML
// Mencegah hasil AI dianggap sebagai HTML
// =========================================================

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


// =========================================================
// RENDER HASIL GENERATE
// Mengubah Markdown sederhana menjadi tampilan clean
// =========================================================

function renderResult(text) {

    let html = escapeHtml(text);

    // Hilangkan horizontal rule
    html = html.replace(
        /^\s*---+\s*$/gm,
        ""
    );

    // Judul utama
    html = html.replace(
        /^###\s+\*\*(.*?)\*\*\s*$/gm,
        '<div class="result-title">$1</div>'
    );

    // Judul level
    html = html.replace(
        /^\*\*Tingkat Kesulitan:\*\*\s*(.*?)$/gm,
        '<div class="result-level"><strong>Tingkat Kesulitan:</strong> $1</div>'
    );

    // Judul Soal
    html = html.replace(
        /^####\s+\*\*Soal\s+(\d+)\*\*\s*$/gm,
        '<div class="question-title">Soal $1</div>'
    );

    // Kalau formatnya "Soal 1" tanpa ####
    html = html.replace(
        /^Soal\s+(\d+)\s*$/gm,
        '<div class="question-title">Soal $1</div>'
    );

    // Kunci jawaban
    html = html.replace(
        /^\*\s+\*\*Kunci Jawaban:\*\*\s*(.*?)$/gm,
        '<div class="answer-key"><strong>Kunci Jawaban:</strong> $1</div>'
    );

    // Pembahasan
    html = html.replace(
        /^\*\s+\*\*Pembahasan Singkat:\*\*\s*(.*?)$/gm,
        '<div class="explanation"><strong>Pembahasan:</strong> $1</div>'
    );

    // Alternatif kalau generator menggunakan Pembahasan saja
    html = html.replace(
        /^\*\s+\*\*Pembahasan:\*\*\s*(.*?)$/gm,
        '<div class="explanation"><strong>Pembahasan:</strong> $1</div>'
    );

    // Opsi A-D
    html = html.replace(
        /^([A-D])\.\s+(.*?)$/gm,
        '<div class="option"><strong>$1.</strong> $2</div>'
    );

    // Bold biasa
    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    // Italic markdown
    html = html.replace(
        /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
        "<em>$1</em>"
    );

    // Bungkus bagian soal
    html = html.replace(
        /(<div class="question-title">Soal \d+<\/div>)([\s\S]*?)(?=<div class="question-title">Soal \d+<\/div>|$)/g,
        '<div class="question-block">$1$2</div>'
    );

    // Baris kosong berurutan
    html = html.replace(
        /\n{3,}/g,
        "\n\n"
    );

    // Newline menjadi spasi/baris
    html = html.replace(
        /\n/g,
        "<br>"
    );

    // Bersihkan <br> berlebihan
    html = html.replace(
        /(<br>\s*){3,}/g,
        "<br><br>"
    );

    // Jangan biarkan br langsung setelah elemen tertentu
    html = html.replace(
        /(<\/div>)<br>/g,
        "$1"
    );

    resultElement.innerHTML = html;
}


// =========================================================
// DROPZONE
// =========================================================

function setupDropzone(
    dropzone,
    input,
    nameEl,
    sizeEl,
    clearBtn
) {

    dropzone.addEventListener("click", () => {
        input.click();
    });


    input.addEventListener("change", function() {

        if (this.files && this.files[0]) {

            const file = this.files[0];

            nameEl.textContent = file.name;

            nameEl.classList.add(
                "text-indigo-700",
                "font-semibold"
            );

            sizeEl.textContent = formatBytes(file.size);

            clearBtn.classList.remove("hidden");

            dropzone.classList.add(
                "border-indigo-400",
                "bg-indigo-50/20"
            );
        }
    });


    clearBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        input.value = "";

        nameEl.textContent =
            input.id === "rps"
                ? "Pilih berkas RPS (.pdf)"
                : "Pilih berkas Modul (.pdf)";

        nameEl.classList.remove(
            "text-indigo-700",
            "font-semibold"
        );

        sizeEl.textContent =
            "Klik untuk menjelajah file";

        clearBtn.classList.add("hidden");

        dropzone.classList.remove(
            "border-indigo-400",
            "bg-indigo-50/20"
        );
    });


    ["dragenter", "dragover"].forEach(eventName => {

        dropzone.addEventListener(eventName, (e) => {

            e.preventDefault();

            dropzone.classList.add(
                "border-indigo-500",
                "bg-indigo-50/50"
            );
        });
    });


    ["dragleave", "drop"].forEach(eventName => {

        dropzone.addEventListener(eventName, (e) => {

            e.preventDefault();

            dropzone.classList.remove(
                "border-indigo-500",
                "bg-indigo-50/50"
            );
        });
    });


    dropzone.addEventListener("drop", (e) => {

        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {

            if (
                files[0].name
                    .toLowerCase()
                    .endsWith(".pdf")
            ) {

                input.files = files;

                const event = new Event("change");

                input.dispatchEvent(event);

            } else {

                showNotification(
                    "Hanya berkas format .PDF yang didukung.",
                    "warning"
                );
            }
        }
    });
}


setupDropzone(
    rpsDropzone,
    rpsInput,
    rpsFilename,
    rpsFilesize,
    rpsClear
);

setupDropzone(
    modulDropzone,
    modulInput,
    modulFilename,
    modulFilesize,
    modulClear
);


// =========================================================
// COUNTER JUMLAH SOAL
// =========================================================

btnMinus.addEventListener("click", () => {

    let val =
        parseInt(numQuestionsInput.value) || 1;

    if (val > 1) {
        numQuestionsInput.value = val - 1;
    }
});


btnPlus.addEventListener("click", () => {

    let val =
        parseInt(numQuestionsInput.value) || 1;

    if (val < 50) {
        numQuestionsInput.value = val + 1;
    }
});


// =========================================================
// NOTIFICATION
// =========================================================

function showNotification(
    message,
    type = "info"
) {

    statusContainer.classList.remove(
        "hidden",
        "bg-emerald-50",
        "border-emerald-200",
        "text-emerald-800",
        "bg-rose-50",
        "border-rose-200",
        "text-rose-800",
        "bg-amber-50",
        "border-amber-200",
        "text-amber-800",
        "bg-indigo-50",
        "border-indigo-200",
        "text-indigo-800"
    );


    if (type === "success") {

        statusContainer.classList.add(
            "bg-emerald-50",
            "border",
            "border-emerald-200",
            "text-emerald-800"
        );

        statusIcon.innerHTML =
            '<i class="fa-solid fa-circle-check text-emerald-600"></i>';

    } else if (type === "error") {

        statusContainer.classList.add(
            "bg-rose-50",
            "border",
            "border-rose-200",
            "text-rose-800"
        );

        statusIcon.innerHTML =
            '<i class="fa-solid fa-circle-exclamation text-rose-600"></i>';

    } else if (type === "warning") {

        statusContainer.classList.add(
            "bg-amber-50",
            "border",
            "border-amber-200",
            "text-amber-800"
        );

        statusIcon.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation text-amber-600"></i>';

    } else {

        statusContainer.classList.add(
            "bg-indigo-50",
            "border",
            "border-indigo-200",
            "text-indigo-800"
        );

        statusIcon.innerHTML =
            '<i class="fa-solid fa-circle-info text-indigo-600"></i>';
    }


    statusElement.textContent = message;
}


// =========================================================
// GENERATE SOAL
// =========================================================

generateButton.addEventListener(
    "click",
    async function() {

        const rps = rpsInput.files[0];
        const modul = modulInput.files[0];

        const topic =
            topicInput.value.trim();

        const numQuestions =
            numQuestionsInput.value;

        const questionFormat =
            questionFormatInput.value;

        const bloomLevel =
            bloomLevelInput.value;


        // Validasi file
        if (!rps || !modul) {

            showNotification(
                "Harap upload dokumen RPS dan Modul terlebih dahulu.",
                "warning"
            );

            return;
        }


        // Validasi topik
        if (!topic) {

            showNotification(
                "Harap masukkan topik bahasan soal.",
                "warning"
            );

            topicInput.focus();

            return;
        }


        // Loading UI
        generateButton.disabled = true;

        btnText.textContent =
            "Memproses RAG...";

        btnIcon.className =
            "fa-solid fa-spinner fa-spin";


        emptyState.classList.add("hidden");

        resultWrapper.classList.add("hidden");

        loadingState.classList.remove("hidden");

        resultBadge.classList.add("hidden");


        try {

            // ==================================================
            // TAHAP 1: PROSES DOKUMEN
            // ==================================================

            loadingStepTitle.textContent =
                "Tahap 1: Memproses Dokumen RPS & Modul...";

            loadingStepDesc.textContent =
                "Membaca teks PDF, melakukan chunking, dan membangun basis pengetahuan dokumen.";

            progressBar.style.width = "45%";

            showNotification(
                "Sedang memproses RPS dan Modul...",
                "info"
            );


            const processData =
                new FormData();

            processData.append(
                "rps",
                rps
            );

            processData.append(
                "modul",
                modul
            );


            const processResponse =
                await fetch(
                    "/process",
                    {
                        method: "POST",
                        body: processData
                    }
                );


            // PENTING:
            // Backend lama mengembalikan TEXT,
            // bukan JSON.

            const processResult =
                await processResponse.text();


            if (!processResponse.ok) {

                throw new Error(
                    processResult ||
                    "Gagal memproses dokumen pada server."
                );
            }


            // ==================================================
            // TAHAP 2: GENERATE SOAL
            // ==================================================

            loadingStepTitle.textContent =
                "Tahap 2: Mensintesis Soal Cerdas...";

            loadingStepDesc.textContent =
                `Mengambil konteks dokumen yang relevan untuk topik "${topic}" (${bloomLevel})...`;

            progressBar.style.width = "85%";

            showNotification(
                "Dokumen berhasil diproses. Sedang membuat soal...",
                "info"
            );


            const generateData =
                new FormData();

            generateData.append(
                "topic",
                topic
            );

            generateData.append(
                "num_questions",
                numQuestions
            );

            generateData.append(
                "question_format",
                questionFormat
            );

            generateData.append(
                "bloom_level",
                bloomLevel
            );


            const generateResponse =
                await fetch(
                    "/generate",
                    {
                        method: "POST",
                        body: generateData
                    }
                );


            // PENTING:
            // Backend lama juga mengembalikan TEXT.

            const generateResult =
                await generateResponse.text();


            if (!generateResponse.ok) {

                throw new Error(
                    generateResult ||
                    "Gagal membuat soal pada server."
                );
            }


            // ==================================================
            // TAMPILKAN HASIL
            // ==================================================

            progressBar.style.width = "100%";

            loadingState.classList.add("hidden");

            resultWrapper.classList.remove("hidden");

            resultBadge.classList.remove("hidden");


            // Simpan hasil raw untuk TXT / Copy
            resultElement.dataset.rawText =
                generateResult;


            // Render hasil menjadi tampilan clean
            renderResult(generateResult);


            charCount.textContent =
                `${generateResult.length.toLocaleString()} Karakter`;


            showNotification(
                "Soal berhasil dibuat secara akurat berbasis dokumen.",
                "success"
            );


        } catch (error) {

            loadingState.classList.add("hidden");

            resultWrapper.classList.remove("hidden");


            showNotification(
                "Terjadi kesalahan saat memproses data.",
                "error"
            );


            resultElement.dataset.rawText =
                `[ERROR]: ${error.message}`;


            resultElement.textContent =
                `[ERROR]: ${error.message}`;


            charCount.textContent =
                `${resultElement.textContent.length} Karakter`;


        } finally {

            generateButton.disabled = false;

            btnText.textContent =
                "Generate Soal Cerdas";

            btnIcon.className =
                "fa-solid fa-wand-magic-sparkles";
        }
    }
);


// =========================================================
// COPY
// =========================================================

copyBtn.addEventListener(
    "click",
    function() {

        const text =
            resultElement.dataset.rawText ||
            resultElement.textContent;


        if (!text) {

            showNotification(
                "Tidak ada konten untuk disalin.",
                "warning"
            );

            return;
        }


        const tempTextArea =
            document.createElement("textarea");

        tempTextArea.value = text;

        tempTextArea.style.position = "fixed";

        tempTextArea.style.opacity = "0";

        document.body.appendChild(
            tempTextArea
        );

        tempTextArea.select();


        try {

            document.execCommand("copy");

            const originalHtml =
                copyBtn.innerHTML;


            copyBtn.innerHTML =
                '<i class="fa-solid fa-check text-emerald-600"></i> <span class="text-emerald-600">Tersalin!</span>';


            setTimeout(() => {

                copyBtn.innerHTML =
                    originalHtml;

            }, 2000);


        } catch (err) {

            showNotification(
                "Gagal menyalin teks ke clipboard.",
                "error"
            );

        } finally {

            document.body.removeChild(
                tempTextArea
            );
        }
    }
);


// =========================================================
// DOWNLOAD TXT
// =========================================================

downloadBtn.addEventListener(
    "click",
    function() {

        const text =
            resultElement.dataset.rawText ||
            resultElement.textContent;


        if (!text) {

            showNotification(
                "Belum ada soal untuk diunduh.",
                "warning"
            );

            return;
        }


        const topicSanitized =
            (
                topicInput.value ||
                "soal_rag"
            )
                .trim()
                .replace(
                    /[^a-z0-9]/gi,
                    "_"
                )
                .toLowerCase();


        const blob =
            new Blob(
                [text],
                {
                    type:
                        "text/plain;charset=utf-8"
                }
            );


        const link =
            document.createElement("a");


        link.href =
            URL.createObjectURL(blob);


        link.download =
            `soal_${topicSanitized}_${Date.now()}.txt`;


        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(
            link.href
        );
    }
);


// =========================================================
// DOWNLOAD PDF
// =========================================================

pdfBtn.addEventListener(
    "click",
    async function() {

        const text =
            resultElement.dataset.rawText ||
            resultElement.textContent;


        if (!text) {

            showNotification(
                "Belum ada soal untuk diunduh.",
                "warning"
            );

            return;
        }


        if (
            typeof html2pdf === "undefined"
        ) {

            showNotification(
                "Library PDF belum siap. Coba refresh halaman.",
                "error"
            );

            return;
        }


        const originalHtml =
            pdfBtn.innerHTML;


        try {

            pdfBtn.disabled = true;

            pdfBtn.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> <span>PDF...</span>';


            /*
             * Buat container khusus PDF.
             * Kita clone hasil yang sudah dirender,
             * sehingga tampilan PDF mengikuti hasil clean.
             */

            const pdfContent =
                document.createElement("div");


            pdfContent.className =
                "pdf-document";


            pdfContent.innerHTML =
                resultElement.innerHTML;


            /*
             * Ukuran A4:
             * 210mm x 297mm
             */

            pdfContent.style.width =
                "170mm";

            pdfContent.style.boxSizing =
                "border-box";


            document.body.appendChild(
                pdfContent
            );


            const topicSanitized =
                (
                    topicInput.value ||
                    "soal_rag"
                )
                    .trim()
                    .replace(
                        /[^a-z0-9]/gi,
                        "_"
                    )
                    .toLowerCase();


            const options = {

                margin: [
                    15,
                    15,
                    15,
                    15
                ],

                filename:
                    `soal_${topicSanitized}_${Date.now()}.pdf`,

                image: {
                    type: "jpeg",
                    quality: 0.98
                },

                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff"
                },

                jsPDF: {
                    unit: "mm",
                    format: "a4",
                    orientation: "portrait"
                },

                pagebreak: {
                    mode: [
                        "css",
                        "legacy"
                    ]
                }
            };


            await html2pdf()
                .set(options)
                .from(pdfContent)
                .save();


            document.body.removeChild(
                pdfContent
            );


        } catch (error) {

            showNotification(
                "Gagal membuat file PDF.",
                "error"
            );

        } finally {

            pdfBtn.disabled = false;

            pdfBtn.innerHTML =
                originalHtml;
        }
    }
);


// =========================================================
// CLEAR RESULT
// =========================================================

clearBtn.addEventListener(
    "click",
    function() {

        resultElement.textContent = "";

        resultElement.dataset.rawText = "";

        resultWrapper.classList.add("hidden");

        loadingState.classList.add("hidden");

        emptyState.classList.remove("hidden");

        resultBadge.classList.add("hidden");

        charCount.textContent =
            "0 Karakter";

        statusContainer.classList.add(
            "hidden"
        );
    }
);

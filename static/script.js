const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const chatbot = document.getElementById('chatbot');
const header = document.getElementById('chatbot-header');
const speakerButton = document.getElementById('speaker-btn');
const chatbotToggle = document.getElementById('chatbot-toggle');
const voiceButton = document.querySelector('.voice-btn');
const listeningIndicator = document.createElement('div');
listeningIndicator.classList.add('listening-indicator');
listeningIndicator.textContent = '      ➔Listening.......';

let isMuted = false;
let isListening = false;
let recognition;
let hasBeeped = false; // Ensure beep plays only once

// Function to toggle chatbot visibility
function toggleChatbot() {
    chatbot.classList.toggle('active');
    chatbotToggle.style.display = chatbot.classList.contains('active') ? 'none' : 'flex';
}

// Function to send a message or file query
async function sendMessage(message) {
    const userMessage = message || chatInput.value.trim();
    if (!userMessage) return;

    displayMessage(userMessage, 'user');

    if (document.getElementById("file-upload").files.length > 0) {
        sendFile();
    } else {
        try {
            const response = await fetch('/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });

            const data = await response.json();
            console.log('Chatbot Response:', data);

            displayMessage(data.response, 'bot');

            if (data.url) {
                let newTab = window.open(data.url, '_blank');
                if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
                    displayMessage(`🔗 <a href="${data.url}" target="_blank">Click here to open</a>`, 'bot');
                }
            }

            chatInput.value = '';
        } catch (error) {
            console.error('Error:', error);
            displayMessage('Error: Unable to connect to the chatbot.', 'bot');
        }
    }
}

// Function to display messages
let isSpeaking = false;
let currentUtterance = null;

function speakResponse(response, speakerIcon) {
    if (!response) return;

    if (isSpeaking) {
        // Stop speech if it's already playing
        window.speechSynthesis.cancel();
        isSpeaking = false;
        speakerIcon.textContent = '🔊'; // Reset icon
    } else {
        // Speak the response
        currentUtterance = new SpeechSynthesisUtterance(response);
        currentUtterance.onend = () => {
            isSpeaking = false;
            speakerIcon.textContent = '🔊'; // Reset icon when speech ends
        };
        window.speechSynthesis.speak(currentUtterance);
        isSpeaking = true;
        speakerIcon.textContent = '🔇'; // Change icon to indicate mute
    }
}

// Function to display messages with formatting
function displayMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);

    // 🔹 1. Handle Bullet Points (*text)
    message = message.replace(/(?:\n|^)\*([^\n]+)/g, '<ul><li>$1</li></ul>');

    // 🔹 2. Handle Bold Text (*text*)
    message = message.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');

    // 🔹 3. Handle Code Blocks with triple backticks (```code```)
    message = message.replace(/```(\w*)\n([\s\S]+?)```/g, function (match, language, code) {
        let escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        let languageClass = language ? ` class="language-${language}"` : '';

        return `<div class="code-block-container">
                    <div class="code-language">${language || 'code'}</div>
                    <pre class="code-block"><code${languageClass}>${escapedCode}</code></pre>
                    <button class="copy-btn" onclick="copyCodeToClipboard(this)">Copy</button>
                </div>`;
    });

    // 🔹 3b. Handle Code Blocks with triple single quotes ('''code''')
    message = message.replace(/'''\n?([\s\S]+?)'''/g, function (match, code) {
        let escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        return `<div class="code-block-container">
                <div class="code-language">code</div>
                <pre class="code-block"><code>${escapedCode}</code></pre>
                <button class="copy-btn" onclick="copyCodeToClipboard(this)">Copy</button>
            </div>`;
    });

    // 🔹 4. Replace newlines with <br> for line breaks (except inside code blocks)
    message = message.replace(/(?<!<\/code>)\n/g, '<br>');

    // Set the formatted message
    messageElement.innerHTML = message;

    document.getElementById('chat-window').appendChild(messageElement);
    document.getElementById('chat-window').scrollTop = document.getElementById('chat-window').scrollHeight;
}
function copyCodeToClipboard(button) {
    const codeElement = button.previousElementSibling; // Select the <code> block
    const codeText = codeElement.innerText || codeElement.textContent; // Extract plain text

    // Create a temporary textarea to copy the text
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = codeText;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();

    try {
        const success = document.execCommand("copy"); // Copy command
        if (success) {
            button.textContent = "Copied!";
            setTimeout(() => {
                button.textContent = "Copy";
            }, 2000);
        } else {
            throw new Error("Copy command failed");
        }
    } catch (err) {
        console.error("Clipboard copy failed:", err);
        alert("Failed to copy code. Please try again.");
    }

    document.body.removeChild(tempTextArea); // Clean up
}



// Event listener for 'Enter' key
chatInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

// Initial greeting from the bot
window.onload = function () {
    setTimeout(() => {
        const greetingMessage = "Hi! I am Ahana. What's your name?";
        displayMessage(greetingMessage, 'bot');
    }, 500);
};

// Voice recognition functionality
function startSpeechRecognition() {
    if (isListening) return;
    isListening = true;

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    chatInput.style.display = 'none';
    voiceButton.style.position = 'absolute';
    voiceButton.style.left = '10px';
    chatbot.appendChild(listeningIndicator);

    // Internal Beep Sound with AudioContext Fix
    function playBeep() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // **Ensure AudioContext is resumed**
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                console.log('AudioContext resumed');
            });
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine"; // Beep type
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // Beep frequency
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); // Volume control

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
        }, 400); // 200ms beep duration
    }

    // Play the beep sound and ensure AudioContext works
    playBeep();

    // Delay 2 seconds after beep before starting speech recognition
    setTimeout(() => {
        recognition.start();
    }, 2000);

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice Input:', transcript);
        sendMessage(transcript);
    };

    recognition.onend = () => {
        isListening = false;
        chatInput.style.display = 'block';
        voiceButton.style.position = 'relative';
        listeningIndicator.remove();
    };

    recognition.onerror = (error) => {
        console.error('Speech recognition error:', error);
        isListening = false;
        listeningIndicator.remove();
    };
}

function toggleDarkMode() {
    const chatbot = document.getElementById('chatbot');
    chatbot.classList.toggle('dark-mode');
}

// Function to toggle mute/unmute
function toggleMute() {
    isMuted = !isMuted;
    speakerButton.textContent = isMuted ? "🔇" : "🔊";
}

chatbot.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', null); // For Firefox compatibility
    const rect = chatbot.getBoundingClientRect();
    chatbot.dataset.offsetX = e.clientX - rect.left;
    chatbot.dataset.offsetY = e.clientY - rect.top;
});

voiceButton.addEventListener('click', startSpeechRecognition);

function toggleDropdown() {
    const menu = document.getElementById('dropdown-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Allowed file extensions
const allowedExtensions = ["pdf", "doc", "txt", "jpg"];

// File Upload Logic
document.getElementById("file-upload").addEventListener("change", function () {
    if (this.files.length > 0) {
        const file = this.files[0];
        const fileName = file.name;
        const fileExt = fileName.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(fileExt)) {
            alert("Invalid file type! Allowed: PDF, DOC, TXT, JPG.");
            this.value = ''; // Clear the file input to prevent unwanted upload
            return; // Stop further execution
        }

        document.getElementById("selected-file-name").textContent = fileName;
        document.getElementById("file-info").style.display = "flex"; // Show file details
    }
});

// Cancel button logic to remove file
document.getElementById("cancel-button").addEventListener("click", function () {
    clearFileInput();
});

// Function to clear file input and hide file info
function clearFileInput() {
    let fileInput = document.getElementById("file-upload");
    fileInput.value = ''; // Reset file input
    document.getElementById("file-info").style.display = "none"; // Hide file info
    document.getElementById("selected-file-name").textContent = ''; // Clear file name
}

// Send file function
async function sendFile() {
    let fileInput = document.getElementById("file-upload");
    let queryInput = document.getElementById("chat-input");

    if (!fileInput.files.length) {
        alert("Please upload a valid file.");
        return;
    }

    if (!queryInput || !queryInput.value.trim()) {
        alert("Please enter a query about the file.");
        return;
    }

    let formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("query", queryInput.value.trim());

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        displayMessage(data.response, "bot");

        // Clear text input & file input after sending
        queryInput.value = "";
        clearFileInput();
    } catch (error) {
        console.error("Error:", error);
        displayMessage("Error processing the file.", "bot");
    }
}
function autoResize(textarea) {
    textarea.style.height = "50px"; // Fixed base height
    let newHeight = textarea.scrollHeight;

    if (newHeight > 80) {
        textarea.style.height = "80px"; // Set max height
        textarea.style.overflowY = "auto"; // Enable scrolling
    } else {
        textarea.style.height = newHeight + "px"; // Adjust height
        textarea.style.overflowY = "hidden"; // Hide scrollbar when not needed
    }
}


















//note pad functions

// Toggle Notepad Visibility
function toggleNotepad() {
    let notepad = document.getElementById("notepadContainer");
    if (notepad.style.display === "none" || notepad.style.display === "") {
        notepad.style.display = "block";
    } else {
        notepad.style.display = "none";
    }
}

// Toggle Feature Buttons in Circular Format
function toggleFeatureButtons() {
    let featureContainer = document.getElementById("feature-buttons");
    featureContainer.classList.toggle("show");
}

// Save Notepad Content
document.getElementById("saveNote").addEventListener("click", function () {
    let text = document.getElementById("notepad").value;
    localStorage.setItem("notepadText", text);
    alert("Note saved!");
});

// Load Notepad Content on Page Load
window.onload = function () {
    let savedText = localStorage.getItem("notepadText");
    if (savedText) {
        document.getElementById("notepad").value = savedText;
    }
};

// Delete Notepad Content
document.getElementById("deleteNote").addEventListener("click", function () {
    document.getElementById("notepad").value = "";
    localStorage.removeItem("notepadText");
    alert("Note cleared!");
});

// Download Notepad Content
document.getElementById("downloadNote").addEventListener("click", function () {
    let text = document.getElementById("notepad").value;
    if (text === "") {
        alert("Nothing to download!");
        return;
    }
    let blob = new Blob([text], { type: "text/plain" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "note.txt";
    a.click();
});

// Cancel Notepad (Closes the notepad without deleting text)
document.getElementById("cancelNote").addEventListener("click", function () {
    document.getElementById("notepadContainer").style.display = "none";
});

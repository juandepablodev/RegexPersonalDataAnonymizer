# Regex Anonymizer & Chat Cleaner (100% Local & Private)

A professional-grade tool, built to **detect and redact personally identifiable information (PII)** from text files and chat logs.

Perfect for preparing chat conversations, reports, or debugging logs before sharing them, ensuring the **complete privacy** of your information.

---

# Why this project?

As part of an extra credit assignment in the course IISSI II (Introduction to Software Engineering and Information Systems), and using regular expressions as a key technique, I developed a tool I personally needed: a text anonymizer.

It is designed to protect and anonymize sensitive personal data, ensuring privacy for both myself and others, and to enable the safe use of AI chatbots without compromising any sensitive data.

This app not only helps us take advantage of recent technological developments such as AI, but also protects one of the most important aspects of our lives, which is increasingly being damaged these days: our privacy.

## Features

### 1. Dual Mode Support (Segmented Control)

* **.txt File Mode**: Upload and process large chat files via streaming (WhatsApp, Telegram, etc.).
* **Plain Text Mode**: Paste text directly, preview the redacted content instantly, copy it to the clipboard with one click, or download it.

### 2. Zero-Retention Privacy Guarantee

* All processing takes place entirely in the **volatile RAM memory** assigned to your browser tab.
* **No cookies, no localStorage, no IndexedDB, and no network connections.**
* Once the tab is closed or the page is refreshed, all sensitive information is permanently removed from the computer.

### 3. Filter Panel

* **Email Addresses** → Replaced with `[EMAIL_HIDDEN]`
* **Phone Numbers** → Replaced with `[PHONE_HIDDEN]`
* **Spanish DNI / NIE IDs** → Replaced with `[ID_HIDDEN]`
* **Credit Card Numbers** → Replaced with `[CARD_HIDDEN]`
* **IP Addresses (IPv4)** → Replaced with `[IP_HIDDEN]`
* **Chat Senders** → Replaced with `[NAME_HIDDEN]`

### 4. Sender Name Extraction Algorithm (Pre-Scan Detection)

When the Chat Senders option is enabled, the application scans the file beforehand to identify chat participants. It builds an in-memory dictionary and automatically replaces every occurrence of those names throughout the conversation, including mentions inside the message content.

### 5. Custom Redaction

Enter words, phrases, or secrets separated by commas. The engine safely escapes special characters and generates a dynamic, case-insensitive regular expression to replace them with `[REDACTED]`.

---

## Regular Expressions

* **Email Addresses**: `\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b`
* **Credit Cards**: `\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b` (Processed first to avoid conflicts)
* **Phone Numbers**: `(?:\b|\+)(?:\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b`
* **Spanish DNI/NIE IDs**: `\b(?:\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-HJ-NP-TV-Z])\b`
* **IP Addresses**: `\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b`

---

## Usage Instructions

### Option A: Interactive Web Interface (Localhost)

1. Open your browser and go to the local server address:
   **http://localhost:3020**
2. Select your working mode (**.txt File** or **Plain Text**).
3. Enable or disable the desired PII filters using the iOS-style switches.
4. Add custom words or phrases to censor in the **Custom Redaction** section if needed.
5. Process the content and instantly download or copy the cleaned text.

### Option B: Python Command-Line Script

For processing very large log files directly from the terminal:

```bash
# General PII cleaning
python cleaner.py my_chat.txt

# PII cleaning + custom words
python cleaner.py my_chat.txt "word1, secret phrase, word2"
```

The script will generate a file named `my_chat_anonymized.txt` in the same directory.

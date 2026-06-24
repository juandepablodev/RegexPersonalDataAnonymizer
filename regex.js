/* ==========================================================================
   ⚡ PII ANONYMIZER - APPLICATION LOGIC 
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias de Elementos del DOM ---
    
    // Selectores de Modo
    const tabFileMode = document.getElementById('tab-file-mode');
    const tabTextMode = document.getElementById('tab-text-mode');
    const fileModeView = document.getElementById('file-mode-view');
    const textModeView = document.getElementById('text-mode-view');
    
    // Toggles de Configuración (Filtros)
    const toggleEmail = document.getElementById('toggle-email');
    const togglePhone = document.getElementById('toggle-phone');
    const toggleDni = document.getElementById('toggle-dni');
    const toggleCard = document.getElementById('toggle-card');
    const toggleIp = document.getElementById('toggle-ip');
    const toggleSender = document.getElementById('toggle-sender');
    const customKeywordsInput = document.getElementById('custom-keywords-input');
    
    // Elementos del Modo Archivo
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileProcessContainer = document.getElementById('file-process-container');
    const infoFileName = document.getElementById('info-file-name');
    const infoFileSize = document.getElementById('info-file-size');
    const cancelBtn = document.getElementById('cancel-btn');
    const startFileBtn = document.getElementById('start-file-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const statLinesProcessed = document.getElementById('stat-lines-processed');
    const statSpeed = document.getElementById('stat-speed');
    
    // Elementos del Modo Texto Plano
    const textPlainInput = document.getElementById('text-plain-input');
    const processTextBtn = document.getElementById('process-text-btn');
    const textPlainOutputContainer = document.getElementById('text-plain-output-container');
    const textPlainOutput = document.getElementById('text-plain-output');
    const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
    const downloadTextBtn = document.getElementById('download-text-btn');
    const clearTextBtn = document.getElementById('clear-text-btn');
    
    // Elementos de la Vista de Éxito (Archivo)
    const successView = document.getElementById('success-view');
    const resTime = document.getElementById('res-time');
    const resTotal = document.getElementById('res-total');
    const resCleaned = document.getElementById('res-cleaned');
    const resSpeed = document.getElementById('res-speed');
    const downloadLink = document.getElementById('download-link');
    const restartBtn = document.getElementById('restart-btn');

    // Desglose de reemplazos
    const textBreakdownCard = document.getElementById('text-breakdown-card');
    const textBreakdownBadges = document.getElementById('text-breakdown-badges');
    const textCensoredDetails = document.getElementById('text-censored-details');
    const fileBreakdownCard = document.getElementById('file-breakdown-card');
    const fileBreakdownBadges = document.getElementById('file-breakdown-badges');
    const fileCensoredDetails = document.getElementById('file-censored-details');

    // --- Estado de la Aplicación (sin almacenamiento físico) ---
    let activeFile = null;
    let cleanBlobUrl = null;
    let textPlainCleanUrl = null;
    let currentMode = 'file'; // 'file' o 'text'

    // --- Expresiones Regulares Estáticas de PII ---
    const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const PHONE_PATTERN = /(?:\b|\+)(?:\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g;
    const DNI_PATTERN = /\b(?:\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-HJ-NP-TV-Z])\b/gi;
    const CARD_PATTERN = /\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b/g;
    const IP_PATTERN = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    
    // Patrón original de metadatos de chat para extraer nombres de remitentes:
    // ^[d/m/aa, hh:mm:ss] Nombre: 
    const CHAT_PATTERN = /^\[\d{1,2}\/\d{1,2}\/\d{2,4},\s\d{1,2}:\d{2}:\d{2}\]\s([^:\r\n]+):\s/;

    // ==========================================================================
    // 🎛️ NAVEGACIÓN Y CONTROL DE VISTAS 
    // ==========================================================================
    
    function switchMode(mode) {
        currentMode = mode;
        
        // Limpieza estricta de memoria al cambiar de modo
        clearAllState();

        if (mode === 'file') {
            tabFileMode.classList.add('active');
            tabTextMode.classList.remove('active');
            fileModeView.classList.add('active');
            textModeView.classList.remove('active');
            successView.classList.remove('active');
        } else {
            tabFileMode.classList.remove('active');
            tabTextMode.classList.add('active');
            fileModeView.classList.remove('active');
            textModeView.classList.add('active');
            successView.classList.remove('active');
        }
    }

    tabFileMode.addEventListener('click', () => switchMode('file'));
    tabTextMode.addEventListener('click', () => switchMode('text'));

    function clearAllState() {
        // Resetear variables y liberar URLs para proteger la privacidad y la memoria RAM
        activeFile = null;
        fileInput.value = '';
        textPlainInput.value = '';
        textPlainOutput.value = '';
        
        if (cleanBlobUrl) {
            URL.revokeObjectURL(cleanBlobUrl);
            cleanBlobUrl = null;
        }
        if (textPlainCleanUrl) {
            URL.revokeObjectURL(textPlainCleanUrl);
            textPlainCleanUrl = null;
        }

        // Ocultar paneles dinámicos
        fileProcessContainer.classList.add('hidden-element');
        progressContainer.classList.add('hidden');
        textPlainOutputContainer.classList.add('hidden-element');
        textBreakdownCard.classList.add('hidden-element');
        fileBreakdownCard.classList.add('hidden-element');
        textCensoredDetails.innerHTML = '';
        fileCensoredDetails.innerHTML = '';
        successView.classList.remove('active');
        
        // Reactivar botones
        startFileBtn.disabled = false;
        startFileBtn.style.opacity = '1';
        processTextBtn.disabled = false;
        processTextBtn.style.opacity = '1';
    }

    // ==========================================================================
    // 📂 SOPORTE DE ARCHIVOS (Drag and Drop & Explorer)
    // ==========================================================================
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelection(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) handleFileSelection(fileInput.files[0]);
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleFileSelection(file) {
        if (!file.name.endsWith('.txt')) {
            alert('Por favor, selecciona únicamente archivos de texto plano (.txt)');
            return;
        }
        activeFile = file;
        
        infoFileName.textContent = file.name;
        infoFileSize.textContent = formatBytes(file.size);
        
        fileProcessContainer.classList.remove('hidden-element');
        progressContainer.classList.add('hidden');
        dropZone.classList.add('hidden-element');
        
        startFileBtn.disabled = false;
        startFileBtn.style.opacity = '1';
    }

    cancelBtn.addEventListener('click', () => {
        clearAllState();
        dropZone.classList.remove('hidden-element');
    });

    restartBtn.addEventListener('click', () => {
        clearAllState();
        dropZone.classList.remove('hidden-element');
        fileModeView.classList.add('active');
    });

    // ==========================================================================
    // 🧠 MOTORES DE COMPILACIÓN DE EXPRESIONES REGULARES DINÁMICAS
    // ==========================================================================
    
    // Función de escape para inyectar texto plano en Regex de forma segura sin romper la sintaxis
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Función para hacer que una expresión regular sea insensible a las tildes en español
    const makeAccentInsensitivePattern = (str) => {
        return str
            .replace(/[aáàäâ]/gi, '[aáàäâ]')
            .replace(/[eéèëê]/gi, '[eéèëê]')
            .replace(/[iíìïî]/gi, '[iíìïî]')
            .replace(/[oóòöô]/gi, '[oóòöô]')
            .replace(/[uúùüû]/gi, '[uúùüû]');
    };

    // Compila el diccionario dinámico de palabras a la carta del usuario
    function getCustomKeywordsRegex() {
        const rawInput = customKeywordsInput.value;
        if (!rawInput || !rawInput.trim()) return null;

        // Dividir por comas, limpiar espacios adicionales y quitar elementos vacíos
        const keywords = rawInput.split(',')
            .map(word => word.trim())
            .filter(word => word.length > 0);

        if (keywords.length === 0) return null;

        // Escapar cada término, hacerlo insensible a acentos y compilar regex insensible a mayúsculas
        try {
            const escaped = keywords.map(escapeRegExp);
            const accentInsensitive = escaped.map(makeAccentInsensitivePattern);
            return new RegExp(accentInsensitive.join('|'), 'gi');
        } catch (e) {
            console.error('Error al compilar la lista de palabras personalizadas:', e);
            return null;
        }
    }

    // ==========================================================================
    // 🛡️ MOTOR PRINCIPAL DE CENSURA Y ANONIMIZACIÓN (PII & Chats)
    // ==========================================================================
    
    function anonymizeLine(line, filters, customRegex, namesRegex, statsAccumulator) {
        let cleanLine = line;
        let changeCount = 0;

        const inc = (key, matches) => {
            if (matches && matches.length > 0) {
                changeCount += matches.length;
                if (statsAccumulator && statsAccumulator[key]) {
                    statsAccumulator[key].count += matches.length;
                    matches.forEach(m => statsAccumulator[key].items.add(m));
                }
            }
        };

        // 1. Anonimización del Remitente al principio de la línea (si es una exportación de chat)
        if (CHAT_PATTERN.test(cleanLine)) {
            const match = CHAT_PATTERN.exec(cleanLine);
            const senderName = match[1];
            
            if (filters.sender) {
                const replacement = `[${senderName}_OCULTO]: `;
                cleanLine = cleanLine.replace(CHAT_PATTERN, replacement);
                inc('sender', [senderName]);
            }
        }

        // 2. Correos electrónicos
        if (filters.email && EMAIL_PATTERN.test(cleanLine)) {
            const matches = cleanLine.match(EMAIL_PATTERN);
            inc('email', matches);
            cleanLine = cleanLine.replace(EMAIL_PATTERN, '[EMAIL_OCULTO]');
        }

        // 3. Tarjetas de Crédito
        if (filters.card && CARD_PATTERN.test(cleanLine)) {
            const matches = cleanLine.match(CARD_PATTERN);
            inc('card', matches);
            cleanLine = cleanLine.replace(CARD_PATTERN, '[TARJETA_OCULTA]');
        }

        // 4. Números de teléfono
        if (filters.phone && PHONE_PATTERN.test(cleanLine)) {
            const matches = cleanLine.match(PHONE_PATTERN);
            inc('phone', matches);
            cleanLine = cleanLine.replace(PHONE_PATTERN, '[TELÉFONO_OCULTO]');
        }

        // 5. Documentos de Identidad (DNI/NIE)
        if (filters.dni && DNI_PATTERN.test(cleanLine)) {
            const matches = cleanLine.match(DNI_PATTERN);
            inc('dni', matches);
            cleanLine = cleanLine.replace(DNI_PATTERN, '[DNI_OCULTO]');
        }

        // 6. Direcciones IP
        if (filters.ip && IP_PATTERN.test(cleanLine)) {
            const matches = cleanLine.match(IP_PATTERN);
            inc('ip', matches);
            cleanLine = cleanLine.replace(IP_PATTERN, '[IP_OCULTA]');
        }

        // 7. Lista de Palabras Personalizadas (Censura a la carta)
        if (customRegex && customRegex.test(cleanLine)) {
            const matches = cleanLine.match(customRegex);
            inc('custom', matches);
            cleanLine = cleanLine.replace(customRegex, '[CENSURADO]');
        }

        // 8. Censura de nombres de remitentes cuando son citados dentro del cuerpo de los mensajes
        if (filters.sender && namesRegex && namesRegex.test(cleanLine)) {
            const matches = cleanLine.match(namesRegex);
            inc('sender', matches);
            cleanLine = cleanLine.replace(namesRegex, '[REMITENTE_OCULTO]');
        }

        return { line: cleanLine, changes: changeCount };
    }

    // ==========================================================================
    // ⚙️ PROCESO DE ANOMINIZACIÓN EN MODO ARCHIVO (Streaming asíncrono)
    // ==========================================================================
    
    startFileBtn.addEventListener('click', async () => {
        if (!activeFile) return;

        // Desactivar botón y preparar interfaz de progreso
        startFileBtn.disabled = true;
        startFileBtn.style.opacity = '0.5';
        progressContainer.classList.remove('hidden');

        // Leer configuraciones de filtros activas
        const filters = {
            email: toggleEmail.checked,
            phone: togglePhone.checked,
            dni: toggleDni.checked,
            card: toggleCard.checked,
            ip: toggleIp.checked,
            sender: toggleSender.checked
        };

        const customRegex = getCustomKeywordsRegex();
        let namesRegex = null;

        // Estadísticas detalladas de PII para archivos
        const fileStats = {
            email: { count: 0, items: new Set() },
            phone: { count: 0, items: new Set() },
            dni: { count: 0, items: new Set() },
            card: { count: 0, items: new Set() },
            ip: { count: 0, items: new Set() },
            sender: { count: 0, items: new Set() },
            custom: { count: 0, items: new Set() }
        };

        const file = activeFile;
        const fileSize = file.size;
        const CHUNK_SIZE = 1024 * 1024 * 2; // Bloques de 2MB
        const startTime = performance.now();

        // ----------------------------------------------------------------------
        // PASO 1 (Solo si el filtro de remitente está activo):
        // Pre-escaneo ultra-rápido para extraer nombres únicos de remitentes
        // ----------------------------------------------------------------------
        const uniqueSenders = new Set();
        if (filters.sender) {
            let offsetScan = 0;
            let partialScanLine = '';
            
            while (offsetScan < fileSize) {
                const slice = file.slice(offsetScan, offsetScan + CHUNK_SIZE);
                offsetScan += CHUNK_SIZE;
                const text = await slice.text();
                
                const lines = (partialScanLine + text).split(/\r?\n/);
                partialScanLine = offsetScan < fileSize ? lines.pop() : '';
                
                for (let i = 0; i < lines.length; i++) {
                    const match = CHAT_PATTERN.exec(lines[i]);
                    if (match) {
                        uniqueSenders.add(match[1].trim());
                    }
                }
            }
            if (partialScanLine) {
                const match = CHAT_PATTERN.exec(partialScanLine);
                if (match) uniqueSenders.add(match[1].trim());
            }

            // Compilar la regex global de nombres encontrados (solo si hay alguno)
            if (uniqueSenders.size > 0) {
                const escapedNames = Array.from(uniqueSenders)
                    .filter(name => name.length > 0)
                    .map(escapeRegExp);
                
                // Asegurar búsqueda con límites de palabra para evitar subcoincidencias accidentales
                namesRegex = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi');
            }
        }

        // ----------------------------------------------------------------------
        // PASO 2: Procesamiento principal y streaming de anonimización
        // ----------------------------------------------------------------------
        let offset = 0;
        let linesProcessedCount = 0;
        let totalCensuredCount = 0;
        const outputChunks = [];
        let partialLine = '';

        const reader = new FileReader();

        reader.onload = function(e) {
            const textChunk = e.target.result;
            const combinedText = partialLine + textChunk;
            const lines = combinedText.split(/\r?\n/);
            
            if (offset < fileSize) {
                partialLine = lines.pop();
            } else {
                partialLine = '';
            }

            const cleanLines = [];
            for (let i = 0; i < lines.length; i++) {
                const result = anonymizeLine(lines[i], filters, customRegex, namesRegex, fileStats);
                linesProcessedCount++;
                totalCensuredCount += result.changes;
                cleanLines.push(result.line);
            }

            outputChunks.push(cleanLines.join('\n') + '\n');

            // Actualizar el progreso visual
            const percent = Math.min(100, Math.round((offset / fileSize) * 100));
            progressFill.style.width = percent + '%';
            progressPercent.textContent = percent + '%';
            
            statLinesProcessed.textContent = linesProcessedCount.toLocaleString();
            
            const currentDuration = (performance.now() - startTime) / 1000;
            const currentSpeed = currentDuration > 0 ? Math.round(linesProcessedCount / currentDuration) : linesProcessedCount;
            statSpeed.textContent = currentSpeed.toLocaleString() + ' l/s';

            readNextChunk();
        };

        reader.onerror = function() {
            alert('Error al leer el archivo. El proceso se detuvo por seguridad.');
            clearAllState();
            dropZone.classList.remove('hidden-element');
        };

        function readNextChunk() {
            if (offset >= fileSize) {
                // Procesar la línea final restante si existe
                if (partialLine) {
                    const result = anonymizeLine(partialLine, filters, customRegex, namesRegex, fileStats);
                    linesProcessedCount++;
                    totalCensuredCount += result.changes;
                    outputChunks.push(result.line);
                }

                // Finalizar el flujo
                const duration = (performance.now() - startTime) / 1000;
                finalizeFileProcessing(outputChunks, duration, linesProcessedCount, totalCensuredCount, fileStats);
                return;
            }

            const slice = file.slice(offset, offset + CHUNK_SIZE);
            offset += CHUNK_SIZE;
            reader.readAsText(slice, 'UTF-8');
        }

        readNextChunk();
    });

    function finalizeFileProcessing(chunks, duration, totalLines, totalCensored, fileStats) {
        // Generar archivo binario plano local
        const cleanBlob = new Blob(chunks, { type: 'text/plain;charset=utf-8' });
        cleanBlobUrl = URL.createObjectURL(cleanBlob);
        
        // Ajustar nombre del archivo de salida
        const originalName = activeFile.name;
        const dotIndex = originalName.lastIndexOf('.');
        const cleanName = dotIndex !== -1 
            ? `${originalName.substring(0, dotIndex)}_anonymized${originalName.substring(dotIndex)}`
            : `${originalName}_anonymized.txt`;
            
        downloadLink.href = cleanBlobUrl;
        downloadLink.download = cleanName;

        // Actualizar estadísticas de éxito
        resTime.textContent = duration.toFixed(3) + 's';
        resTotal.textContent = totalLines.toLocaleString();
        resCleaned.textContent = totalCensored.toLocaleString();
        
        const speed = duration > 0 ? Math.round(totalLines / duration) : totalLines;
        resSpeed.textContent = speed.toLocaleString() + ' l/s';

        // Renderizar el desglose de censura de archivo con los valores detectados
        renderBreakdownBadges(fileBreakdownBadges, fileBreakdownCard, fileStats, fileCensoredDetails);

        // Ocultar vistas operativas y mostrar pantalla de éxito
        fileModeView.classList.remove('active');
        successView.classList.add('active');
    }

    // ==========================================================================
    // 📝 PROCESO DE ANONIMIZACIÓN EN MODO TEXTO PLANO (En memoria RAM volátil)
    // ==========================================================================
    processTextBtn.addEventListener('click', () => {
        const text = textPlainInput.value;
        if (!text || !text.trim()) {
            alert('Por favor, ingresa o pega algún texto para poder censurarlo.');
            return;
        }

        processTextBtn.disabled = true;
        processTextBtn.style.opacity = '0.5';

        // Capturar filtros
        const filters = {
            email: toggleEmail.checked,
            phone: togglePhone.checked,
            dni: toggleDni.checked,
            card: toggleCard.checked,
            ip: toggleIp.checked,
            sender: toggleSender.checked
        };

        const customRegex = getCustomKeywordsRegex();
        let namesRegex = null;

        // Estadísticas detalladas de PII para texto plano
        const textStats = {
            email: { count: 0, items: new Set() },
            phone: { count: 0, items: new Set() },
            dni: { count: 0, items: new Set() },
            card: { count: 0, items: new Set() },
            ip: { count: 0, items: new Set() },
            sender: { count: 0, items: new Set() },
            custom: { count: 0, items: new Set() }
        };

        // Dividir el texto en líneas para procesar
        const lines = text.split(/\r?\n/);
        
        // Si el filtro de remitente está activo, extraer nombres únicos en caliente
        if (filters.sender) {
            const uniqueSenders = new Set();
            for (let i = 0; i < lines.length; i++) {
                const match = CHAT_PATTERN.exec(lines[i]);
                if (match) uniqueSenders.add(match[1].trim());
            }

            if (uniqueSenders.size > 0) {
                const escapedNames = Array.from(uniqueSenders).map(escapeRegExp);
                namesRegex = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi');
            }
        }

        // Anonimizar línea por línea
        const cleanLines = [];
        let totalCensored = 0;

        for (let i = 0; i < lines.length; i++) {
            const result = anonymizeLine(lines[i], filters, customRegex, namesRegex, textStats);
            totalCensored += result.changes;
            cleanLines.push(result.line);
        }

        const cleanText = cleanLines.join('\n');

        // Mostrar salida en el DOM
        textPlainOutput.value = cleanText;
        textPlainOutputContainer.classList.remove('hidden-element');

        // Renderizar el desglose de censura de texto plano con los valores detectados
        renderBreakdownBadges(textBreakdownBadges, textBreakdownCard, textStats, textCensoredDetails);
        
        // Crear Blob temporal en memoria RAM exclusivamente para la descarga opcional
        if (textPlainCleanUrl) {
            URL.revokeObjectURL(textPlainCleanUrl);
        }
        const textBlob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
        textPlainCleanUrl = URL.createObjectURL(textBlob);

        // Habilitar botón de procesar de nuevo
        processTextBtn.disabled = false;
        processTextBtn.style.opacity = '1';
    });

    // Acción de Copiar al Portapapeles
    copyClipboardBtn.addEventListener('click', () => {
        const textToCopy = textPlainOutput.value;
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = copyClipboardBtn.innerHTML;
            copyClipboardBtn.innerHTML = '<span>Copiado con éxito! ✓</span>';
            copyClipboardBtn.style.borderColor = 'var(--accent-green)';
            
            setTimeout(() => {
                copyClipboardBtn.innerHTML = originalText;
                copyClipboardBtn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }, 2000);
        }).catch(err => {
            console.error('Error al copiar al portapapeles:', err);
            alert('No se pudo acceder al portapapeles de forma automática. Por favor copia el texto manualmente.');
        });
    });

    // Acción de Guardar Texto Plano como Archivo local
    downloadTextBtn.addEventListener('click', () => {
        if (!textPlainCleanUrl) return;
        
        const tempLink = document.createElement('a');
        tempLink.href = textPlainCleanUrl;
        tempLink.download = 'texto_anonimizado.txt';
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
    });

    // Acción de Limpiar Todo el modo de texto plano (Protección de Privacidad al instante)
    clearTextBtn.addEventListener('click', () => {
        clearAllState();
    });

    // Renderizado dinámico de Badges y lista detallada de auditoría con desglose estilo Apple
    function renderBreakdownBadges(container, cardElement, stats, detailsContainer) {
        const categoryInfo = {
            email: { label: 'Correos Electrónicos', icon: '📧' },
            phone: { label: 'Números de Teléfono', icon: '📞' },
            dni: { label: 'Identificaciones (DNI/NIE)', icon: '🆔' },
            card: { label: 'Tarjetas de Crédito', icon: '💳' },
            ip: { label: 'Direcciones IP', icon: '🌐' },
            sender: { label: 'Nombres de Remitentes', icon: '👤' },
            custom: { label: 'Censuras a la Carta', icon: '🏷️' }
        };

        container.innerHTML = '';
        detailsContainer.innerHTML = '';
        let totalSum = 0;

        for (const key in stats) {
            const count = stats[key].count;
            totalSum += count;
            
            if (count > 0) {
                // 1. Crear el badge de conteo
                const badge = document.createElement('div');
                badge.className = `breakdown-badge badge-${key}`;
                badge.innerHTML = `<span>${categoryInfo[key].icon}</span> <span>${categoryInfo[key].label}: ${count}</span>`;
                container.appendChild(badge);

                // 2. Crear la fila con el desglose de valores únicos eliminados
                const row = document.createElement('div');
                row.className = 'breakdown-detail-row';
                
                const uniqueValues = Array.from(stats[key].items).sort();
                const valuesString = uniqueValues.join(', ');

                row.innerHTML = `
                    <div class="breakdown-detail-label">
                        <span>${categoryInfo[key].icon}</span>
                        <span>${categoryInfo[key].label} detectados:</span>
                    </div>
                    <div class="breakdown-detail-values">${valuesString}</div>
                `;
                detailsContainer.appendChild(row);
            }
        }

        if (totalSum > 0) {
            cardElement.classList.remove('hidden-element');
        } else {
            cardElement.classList.add('hidden-element');
        }
    }
});

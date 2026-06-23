#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import os
import re
import sys
import time

# Compilar expresiones regulares estáticas de PII para velocidad extrema
EMAIL_PATTERN = re.compile(r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b')
PHONE_PATTERN = re.compile(r'(?:\b|\+)(?:\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b')
DNI_PATTERN = re.compile(r'\b(?:\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-HJ-NP-TV-Z])\b', re.IGNORECASE)
CARD_PATTERN = re.compile(r'\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b')
IP_PATTERN = re.compile(r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b')

# Patrón original de metadatos de chat para extraer nombres de remitentes:
CHAT_HEADER_PATTERN = re.compile(r'^\[\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2}:\d{2}\]\s([^:\r\n]+):\s')

def print_banner():
    """Imprime un banner estilo terminal."""
    print("+---------------------------------------------------------------+")
    print("|               PII ANONYMIZER & CHAT CLEANER                   |")
    print("|         Procesador de Texto Seguro y 100% Privado             |")
    print("+---------------------------------------------------------------+")

def make_accent_insensitive_pattern(s):
    """Reemplaza vocales por clases de caracteres con tildes para búsqueda insensible a acentos."""
    s = re.sub(r'[aáàäâ]', '[aáàäâ]', s, flags=re.IGNORECASE)
    s = re.sub(r'[eéèëê]', '[eéèëê]', s, flags=re.IGNORECASE)
    s = re.sub(r'[iíìïî]', '[iíìïî]', s, flags=re.IGNORECASE)
    s = re.sub(r'[oóòöô]', '[oóòöô]', s, flags=re.IGNORECASE)
    s = re.sub(r'[uúùüû]', '[uúùüû]', s, flags=re.IGNORECASE)
    return s

def get_custom_keywords_regex(keywords_str):
    """Compila y escapa una lista de palabras clave personalizadas en un RegExp."""
    if not keywords_str or not keywords_str.strip():
        return None
    
    # Dividir por comas y limpiar
    words = [w.strip() for w in keywords_str.split(',') if w.strip()]
    if not words:
        return None
    
    # Escapar caracteres especiales para RegExp de forma segura y hacerlos insensibles a tildes
    escaped = [re.escape(w) for w in words]
    accent_insensitive = [make_accent_insensitive_pattern(w) for w in escaped]
    return re.compile('|'.join(accent_insensitive), re.IGNORECASE)

def anonymize_text_line(line, custom_regex, names_regex, stats=None):
    """
    Realiza sustitución semántica de PII y términos confidenciales en una línea.
    """
    clean_line = line
    changes = 0
    
    def inc(key, found_list):
        nonlocal changes
        if found_list:
            count = len(found_list)
            changes += count
            if stats is not None and key in stats:
                stats[key]['count'] += count
                for item in found_list:
                    stats[key]['items'].add(item)

    # 1. Censura de la cabecera original del remitente de chat
    header_match = CHAT_HEADER_PATTERN.match(clean_line)
    if header_match:
        sender_name = header_match.group(1)
        replacement = f"[{sender_name}_OCULTO]: "
        # Reemplazar solo al inicio
        clean_line, count = CHAT_HEADER_PATTERN.subn(replacement, clean_line, count=1)
        if count > 0:
            inc('sender', [sender_name])
        
    # 2. Correos electrónicos
    emails = EMAIL_PATTERN.findall(clean_line)
    if emails:
        clean_line, count = EMAIL_PATTERN.subn('[EMAIL_OCULTO]', clean_line)
        inc('email', emails)
    
    # 3. Tarjetas de crédito
    cards = CARD_PATTERN.findall(clean_line)
    if cards:
        clean_line, count = CARD_PATTERN.subn('[TARJETA_OCULTA]', clean_line)
        inc('card', cards)
    
    # 4. Teléfonos
    phones = PHONE_PATTERN.findall(clean_line)
    if phones:
        clean_line, count = PHONE_PATTERN.subn('[TELÉFONO_OCULTO]', clean_line)
        inc('phone', phones)
    
    # 5. DNI/NIE de España
    dnis = DNI_PATTERN.findall(clean_line)
    if dnis:
        clean_line, count = DNI_PATTERN.subn('[DNI_OCULTO]', clean_line)
        inc('dni', dnis)
    
    # 6. Direcciones IP
    ips = IP_PATTERN.findall(clean_line)
    if ips:
        clean_line, count = IP_PATTERN.subn('[IP_OCULTA]', clean_line)
        inc('ip', ips)
    
    # 7. Palabras personalizadas
    if custom_regex:
        customs = custom_regex.findall(clean_line)
        if customs:
            clean_line, count = custom_regex.subn('[CENSURADO]', clean_line)
            inc('custom', customs)
        
    # 8. Censura de nombres de remitentes citados internamente
    if names_regex:
        senders = names_regex.findall(clean_line)
        if senders:
            clean_line, count = names_regex.subn('[REMITENTE_OCULTO]', clean_line)
            inc('sender', senders)
        
    return clean_line, changes

def clean_chat_file(input_path, custom_keywords_str=None):
    """
    Limpia un archivo de texto por streaming con doble pasada para nombres de remitentes.
    """
    if not os.path.exists(input_path):
        print(f"[-] Error: El archivo '{input_path}' no existe.")
        return

    # Preparar rutas de salida
    dir_name, file_name = os.path.split(input_path)
    base_name, ext = os.path.splitext(file_name)
    output_name = f"{base_name}_anonymized{ext}"
    output_path = os.path.join(dir_name, output_name)

    print(f"\n[i] Archivo de entrada: {input_path}")
    print(f"[i] Archivo de salida:  {output_path}")
    
    # Compilar palabras personalizadas si existen
    custom_regex = get_custom_keywords_regex(custom_keywords_str)
    if custom_regex:
        print("[i] Filtro de palabras personalizadas activo.")
        
    # PASO 1: Descubrimiento dinámico de nombres de remitentes (Pre-escaneo rápido)
    print("[i] Analizando estructura de remitentes de chat...")
    unique_senders = set()
    chunk_size = 1024 * 1024  # Búfer de 1MB
    
    try:
        with open(input_path, 'r', encoding='utf-8', errors='ignore', buffering=chunk_size) as scan_file:
            for line in scan_file:
                match = CHAT_HEADER_PATTERN.match(line)
                if match:
                    unique_senders.add(match.group(1).strip())
                    
        # Compilar RegExp de nombres de remitentes
        names_regex = None
        if unique_senders:
            escaped_names = [re.escape(name) for name in unique_senders if name]
            # Usar límites de palabra \b para evitar sustituciones erróneas en subpalabras
            names_regex = re.compile(r'\b(' + '|'.join(escaped_names) + r')\b', re.IGNORECASE)
            print(f"[+] Remitentes detectados para anonimizacion: {len(unique_senders)}")
        else:
            print("[i] No se detectaron cabeceras de chat. Procesando como texto plano estándar.")

        print("[i] Iniciando anonimizacion local... Por favor espera.")
        start_time = time.perf_counter()
        
        total_lines = 0
        total_changes = 0
        
        # Inicializar métricas detalladas para CLI
        cli_stats = {
            'email':  {'count': 0, 'items': set()},
            'phone':  {'count': 0, 'items': set()},
            'dni':    {'count': 0, 'items': set()},
            'card':   {'count': 0, 'items': set()},
            'ip':     {'count': 0, 'items': set()},
            'sender': {'count': 0, 'items': set()},
            'custom': {'count': 0, 'items': set()}
        }
        
        # PASO 2: Anonimización principal y escritura por streaming
        with open(input_path, 'r', encoding='utf-8', errors='ignore', buffering=chunk_size) as infile, \
             open(output_path, 'w', encoding='utf-8', buffering=chunk_size) as outfile:
             
            for line in infile:
                total_lines += 1
                clean_line, count = anonymize_text_line(line, custom_regex, names_regex, cli_stats)
                total_changes += count
                outfile.write(clean_line)
                
                if total_lines % 50000 == 0:
                    print(f" >>> Procesadas {total_lines:,} lineas...", end='\r')

        end_time = time.perf_counter()
        elapsed = end_time - start_time
        
        # Resultados
        print("\n\n+---------------------------------------------------------------+")
        print("|                     RESULTADOS DEL PROCESO                    |")
        print("+---------------------------------------------------------------+")
        print(f"|  Tiempo transcurrido:    {elapsed:.4f} segundos")
        print(f"|  Lineas procesadas:      {total_lines:,}")
        print(f"|  Elementos censurados:   {total_changes:,}")
        print(f"|  Velocidad de proceso:   {(total_lines / elapsed) if elapsed > 0 else total_lines:,.0f} lineas/seg")
        print("+---------------------------------------------------------------+")
        
        if total_changes > 0:
            print("|  DESGLOSE DE CENSURA REALIZADA:                               |")
            labels = {
                'email':  'Correos Electronicos',
                'phone':  'Numeros de Telefono',
                'dni':    'Identificaciones (DNI/NIE)',
                'card':   'Tarjetas de Credito',
                'ip':     'Direcciones IP',
                'sender': 'Nombres de Remitentes',
                'custom': 'Censuras a la Carta'
            }
            for k, v in cli_stats.items():
                if v['count'] > 0:
                    unique_vals = ", ".join(sorted(list(v['items'])))
                    # Limitar longitud para evitar rotura de diseño en la terminal
                    if len(unique_vals) > 28:
                        unique_vals = unique_vals[:25] + "..."
                    output_line = f"|  - {labels[k]:<27} : {v['count']} ({unique_vals})"
                    print(f"{output_line:<64}|")
            print("+---------------------------------------------------------------+")
            
        print("\n[+] ¡Anonimizacion completada con exito! Privacidad local al 100% garantizada.")
        
    except Exception as e:
        print(f"\n[-] Ocurrio un error inesperado al procesar el archivo: {e}")

if __name__ == "__main__":
    print_banner()
    
    if len(sys.argv) > 1:
        # Modo Consola pasándole los argumentos de línea de comandos
        input_file = sys.argv[1]
        custom_words = None
        if len(sys.argv) > 2:
            custom_words = sys.argv[2]
        clean_chat_file(input_file, custom_words)
    else:
        # Modo Interactivo amigable
        print("\nArrastre su archivo .txt aqui y presione Enter:")
        path = input("👉 ").strip('\'"')
        if path:
            print("\nEscriba palabras personalizadas a censurar (separadas por comas, o Enter para omitir):")
            words_input = input("👉 ").strip()
            clean_chat_file(path, words_input if words_input else None)
        else:
            print("[-] No se especifico ninguna ruta de archivo.")

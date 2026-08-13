import json
import os
import sys

transcript_path = "/Users/macy/.gemini/antigravity-ide/brain/fbcf944a-3397-4bb2-b3aa-60fc6d6239ff/.system_generated/logs/transcript_full.jsonl"

ocr_data = []

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        step = json.loads(line)
        if step.get("type") == "USER_INPUT":
            content = step.get("content", "")
            print(f"Found USER_INPUT of length {len(content)}")
            if "Start of PDF" in content:
                print("Found Start of PDF in content!")
                start_idx = content.find("==Start of PDF==")
                end_idx = content.find("==End of PDF==")
                if start_idx != -1 and end_idx != -1:
                    pdf_text = content[start_idx:end_idx]
                    
                    # Split into pages
                    pages = pdf_text.split("==Screenshot for page")
                    for page in pages[1:]:
                        if "==Start of OCR for page" in page:
                            ocr_start = page.find("==Start of OCR for page")
                            ocr_end = page.find("==End of OCR for page")
                            if ocr_start != -1 and ocr_end != -1:
                                ocr_content = page[ocr_start:ocr_end].split('\n', 1)[1] # skip the start marker line
                                ocr_data.append(ocr_content)

print(f"Extracted {len(ocr_data)} pages of OCR text.")
with open("ocr_dump.txt", "w", encoding="utf-8") as out:
    for i, page in enumerate(ocr_data):
        out.write(f"--- PAGE {i+1} ---\n")
        out.write(page + "\n")

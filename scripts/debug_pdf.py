import pdfplumber
import sys

filepath = "local train timetable/mumbai local train western line down.pdf"
try:
    with pdfplumber.open(filepath) as pdf:
        page = pdf.pages[0]
        tables = page.extract_tables()
        print(f"Found {len(tables)} tables on page 1")
        if tables:
            table = tables[0]
            for row in table[:10]:
                print(row)
except Exception as e:
    print(e)

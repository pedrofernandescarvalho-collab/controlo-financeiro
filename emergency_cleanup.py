import os

files_to_clean = ["index.html", "dashboard.html", "extrato.html", "configuracao.html", "pro360.html"]

def clean_html(filename):
    if not os.path.exists(filename):
        print(f"File {filename} not found.")
        return
        
    print(f"Cleaning {filename}...")
    
    # Read as binary to avoid encoding issues
    try:
        with open(filename, 'rb') as f:
            content = f.read()
            
        # Try to decode from various encodings to find the text
        text = None
        for enc in ['utf-16', 'utf-8', 'cp1252', 'latin-1']:
            try:
                text = content.decode(enc)
                if '</html>' in text:
                    print(f"  Success decoding with {enc}")
                    break
            except:
                continue
        
        if text:
            # Find the first </html> and truncate
            idx = text.find('</html>')
            if idx != -1:
                clean_text = text[:idx + 7] # +7 to include </html>
                
                # Write back as clean UTF-8
                with open(filename, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(clean_text)
                print(f"  {filename} cleaned and saved as UTF-8.")
            else:
                print(f"  Warning: </html> not found in {filename} after decoding.")
        else:
            print(f"  Error: Could not decode {filename}.")
            
    except Exception as e:
        print(f"  Error processing {filename}: {str(e)}")

for f in files_to_clean:
    clean_html(f)

# Also ensure JS files are UTF-8
js_files = ["core-engine.js", "firebase-sync.js", "service-worker.js"]
for js in js_files:
    if os.path.exists(js):
        try:
            with open(js, 'rb') as f:
                content = f.read()
            # Try to fix encoding to UTF-8
            for enc in ['utf-16', 'utf-8', 'cp1252']:
                try:
                    text = content.decode(enc)
                    with open(js, 'w', encoding='utf-8', newline='\n') as f:
                        f.write(text)
                    print(f"  {js} saved as UTF-8.")
                    break
                except:
                    continue
        except:
             pass

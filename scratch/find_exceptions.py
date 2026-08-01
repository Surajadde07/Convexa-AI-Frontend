import os

backend_dir = r"c:\Users\suraj\Desktop\CONEXA AI PROJECT\convexa-ai-backend\src\main\java"
for root, dirs, files in os.walk(backend_dir):
    for f in files:
        if f.endswith(".java"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                content = file.read()
                if "ControllerAdvice" in content or "ExceptionHandler" in content:
                    print(f"Found in {path}")

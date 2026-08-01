filepath = r"c:\Users\suraj\Desktop\CONEXA AI PROJECT\convexa-ai-ui\src\pages\DashboardPage.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i == 2383: # line 2384 is index 2383
        print("Removing line 2384:", repr(line))
        continue
    new_lines.append(line)

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Orphaned line 2384 removed!")

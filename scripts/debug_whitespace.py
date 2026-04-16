with open("d:/SMARTAPPLY/Backend/app/services/jarvis_service.py", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i in range(85, 105):
        print(f"{i+1}: {repr(lines[i])}")

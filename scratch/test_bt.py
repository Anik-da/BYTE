import subprocess

def test_bt():
    cmd = 'powershell -Command "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, InstanceId"'
    try:
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=5)
        print("Bluetooth devices:")
        print(out)
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    test_bt()

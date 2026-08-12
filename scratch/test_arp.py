import subprocess

def test_arp():
    try:
        out = subprocess.check_output("arp -a", shell=True, text=True, timeout=3)
        print("ARP -A Output:")
        print(out)
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    test_arp()

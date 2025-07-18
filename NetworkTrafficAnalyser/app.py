from flask import Flask, jsonify, render_template, send_from_directory
from scapy.all import sniff, IP, TCP
import os
from threading import Thread
from flask import request
import time

app = Flask(__name__, static_folder='static', template_folder='templates')
blocked_ips = set()
captured_packets = []
monitoring = True

proto_map = {0: "HOPOPT", 1: "ICMP", 2: "IGMP", 3: "GGP", 4: "IPv4", 5: "ST", 6: "TCP", 7: "CBT", 8: "EGP", 9: "IGP", 10: "BBN-RCC-MON", 11: "NVP-II", 12: "PUP", 13: "ARGUS (deprecated)", 14: "EMCON", 15: "XNET", 16: "CHAOS", 17: "UDP", 18: "MUX", 19: "DCN-MEAS", 20: "HMP", 21: "PRM", 22: "XNS-IDP", 23: "TRUNK-1", 24: "TRUNK-2", 
             25: "LEAF-1", 26: "LEAF-2", 27: "RDP", 28: "IRTP", 29: "ISO-TP4", 30: "NETBLT", 31: "MFE-NSP", 32: "MERIT-INP", 33: "DCCP", 34: "3PC", 35: "IDPR", 36: "XTP", 37: "DDP", 38: "IDPR-CMTP", 39: "TP++", 40: "IL", 41: "IPv6", 42: "SDRP", 43: "IPv6-Route", 44: "IPv6-Frag", 45: "IDRP", 46: "RSVP", 47: "GRE", 48: "DSR", 
             49: "BNA", 50: "ESP", 51: "AH", 52: "I-NLSP", 53: "SWIPE (deprecated)", 54: "NARP", 55: "Min-IPv4", 56: "TLSP", 57: "SKIP", 58: "IPv6-ICMP", 59: "IPv6-NoNxt", 60: "IPv6-Opts", 61: "any host internal protocol", 62: "CFTP", 63: "any local network", 64: "SAT-EXPAK", 65: "KRYPTOLAN", 66: "RVD", 67: "IPPC", 
             68: "any distributed file system", 69: "SAT-MON", 70: "VISA", 71: "IPCV", 72: "CPNX", 73: "CPHB", 74: "WSN", 75: "PVP", 76: "BR-SAT-MON", 77: "SUN-ND", 78: "WB-MON", 79: "WB-EXPAK", 80: "ISO-IP", 81: "VMTP", 82: "SECURE-VMTP", 83: "VINES", 84: "IPTM", 85: "NSFNET-IGP", 86: "DGP", 87: "TCF", 88: "EIGRP", 89: "OSPFIGP", 
             90: "Sprite-RPC", 91: "LARP", 92: "MTP", 93: "AX.25", 94: "IPIP", 95: "MICP (deprecated)", 96: "SCC-SP", 97: "ETHERIP", 98: "ENCAP", 99: "any private encryption scheme", 100: "GMTP", 101: "IFMP", 102: "PNNI", 103: "PIM", 104: "ARIS", 105: "SCPS", 106: "QNX", 107: "A/N", 108: "IPComp", 109: "SNP", 110: "Compaq-Peer",
             111: "IPX-in-IP", 112: "VRRP", 113: "PGM", 114: "any 0-hop protocol", 115: "L2TP", 116: "DDX", 117: "IATP", 118: "STP", 119: "SRP", 120: "UTI", 121: "SMP", 122: "SM (deprecated)", 123: "PTP", 124: "ISIS over IPv4", 125: "FIRE", 126: "CRTP", 127: "CRUDP", 128: "SSCOPMCE", 129: "IPLT", 130: "SPS", 131: "PIPE", 132: "SCTP", 
             133: "FC", 134: "RSVP-E2E-IGNORE", 135: "Mobility Header", 136: "UDPLite", 137: "MPLS-in-IP", 138: "manet", 139: "HIP", 140: "Shim6", 141: "WESP", 142: "ROHC", 143: "Ethernet", 144: "AGGFRAG", 145: "NSH", 146: "Homa", 147: "BIT-EMU", 148: "Unassigned", 149: "Unassigned", 150: "Unassigned", 151: "Unassigned", 152: "Unassigned", 
             153: "Unassigned", 154: "Unassigned", 155: "Unassigned", 156: "Unassigned", 157: "Unassigned", 158: "Unassigned", 159: "Unassigned", 160: "Unassigned", 161: "Unassigned", 162: "Unassigned", 163: "Unassigned", 164: "Unassigned", 165: "Unassigned", 166: "Unassigned", 167: "Unassigned", 168: "Unassigned", 169: "Unassigned", 170: "Unassigned", 
             171: "Unassigned", 172: "Unassigned", 173: "Unassigned", 174: "Unassigned", 175: "Unassigned", 176: "Unassigned", 177: "Unassigned", 178: "Unassigned", 179: "Unassigned", 180: "Unassigned", 181: "Unassigned", 182: "Unassigned", 183: "Unassigned", 184: "Unassigned", 185: "Unassigned", 186: "Unassigned", 187: "Unassigned", 188: "Unassigned", 
             189: "Unassigned", 190: "Unassigned", 191: "Unassigned", 192: "Unassigned", 193: "Unassigned", 194: "Unassigned", 195: "Unassigned", 196: "Unassigned", 197: "Unassigned", 198: "Unassigned", 199: "Unassigned", 200: "Unassigned", 201: "Unassigned", 202: "Unassigned", 203: "Unassigned", 204: "Unassigned", 205: "Unassigned", 206: "Unassigned", 
             207: "Unassigned", 208: "Unassigned", 209: "Unassigned", 210: "Unassigned", 211: "Unassigned", 212: "Unassigned", 213: "Unassigned", 214: "Unassigned", 215: "Unassigned", 216: "Unassigned", 217: "Unassigned", 218: "Unassigned", 219: "Unassigned", 220: "Unassigned", 221: "Unassigned", 222: "Unassigned", 223: "Unassigned", 224: "Unassigned", 
             225: "Unassigned", 226: "Unassigned", 227: "Unassigned", 228: "Unassigned", 229: "Unassigned", 230: "Unassigned", 231: "Unassigned", 232: "Unassigned", 233: "Unassigned", 234: "Unassigned", 235: "Unassigned", 236: "Unassigned", 237: "Unassigned", 238: "Unassigned", 239: "Unassigned", 240: "Unassigned", 241: "Unassigned", 242: "Unassigned", 
             243: "Unassigned", 244: "Unassigned", 245: "Unassigned", 246: "Unassigned", 247: "Unassigned", 248: "Unassigned", 249: "Unassigned", 250: "Unassigned", 251: "Unassigned", 252: "Unassigned", 253: "Use for experimentation and testing", 254: "Use for experimentation and testing", 255: "Reserved"}


total_packets = 0

@app.route('/api/pause_monitoring', methods=['POST'])
def pause_monitoring():
    global monitoring
    monitoring = False
    return jsonify({'status': 'paused'})

@app.route('/api/start_monitoring', methods=['POST'])
def start_monitoring():
    global monitoring
    monitoring = True
    return jsonify({'status': 'started'})

def packet_callback(packet):
    global total_packets, monitoring, blocked_ips
    if not monitoring or IP not in packet:
        return

    src_ip = packet[IP].src
    dst_ip = packet[IP].dst

    if src_ip in blocked_ips or dst_ip in blocked_ips:
        return

    proto_num = packet.proto
    proto_name = proto_map.get(proto_num, f"Unknown ({proto_num})")

    src_port = dst_port = None

    if packet.haslayer(TCP):
        src_port = packet[TCP].sport
        dst_port = packet[TCP].dport
    elif packet.haslayer("UDP"):
        src_port = packet["UDP"].sport
        dst_port = packet["UDP"].dport

    total_packets += 1
    captured_packets.append({
        "src": src_ip,
        "dst": dst_ip,
        "proto": proto_name,
        "src_port": src_port,
        "dst_port": dst_port,
        "time": time.strftime('%H:%M:%S'),
    })


@app.route("/api/block_ips", methods=["POST"])
def block_ips():
    global blocked_ips
    data = request.get_json()
    ips = data.get("ips", [])
    blocked_ips.update(ips)
    return jsonify({"blocked": list(blocked_ips)})

@app.route("/api/unblock_ips", methods=["POST"])
def unblock_ips():
    global blocked_ips
    data = request.get_json()
    ips = data.get("ips", [])
    blocked_ips.difference_update(ips)
    return jsonify({"blocked": list(blocked_ips)})

def start_sniffer():
    sniff(filter="ip", prn=packet_callback, store=False)

@app.route("/")
def index():
    return render_template("NetworkTrafficAnalyser.html")

@app.route("/api/packets")
def get_packets():
    return jsonify(captured_packets)

@app.route("/api/packet_count")
def get_packet_count():
    return jsonify({"total": total_packets})

@app.route('/api/reset', methods=['POST'])
def reset_packets():
    global captured_packets, total_packets
    captured_packets = []
    total_packets = 0
    return jsonify({"status": "reset"}), 200

if __name__ == "__main__":
    Thread(target=start_sniffer, daemon=True).start()
    app.run(debug=True)

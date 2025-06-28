function fetchPackets() {
  fetch('/api/packets')
    .then(response => response.json())
    .then(data => {
      const protocol = document.getElementById('protocolFilter').value.toLowerCase();
      const srcIP = document.getElementById('srcFilter').value;
      const dstIP = document.getElementById('dstFilter').value;

      const tableBody = document.getElementById('packet-table');
      tableBody.innerHTML = '';

      const filteredData = data.filter(packet => {
       const matchesProto = !protocol || packet.proto.toLowerCase().includes(protocol);
        const matchesSrc = !srcIP || packet.src.includes(srcIP);
        const matchesDst = !dstIP || packet.dst.includes(dstIP);
        return matchesProto && matchesSrc && matchesDst;
      });

      filteredData.slice().reverse().forEach(packet => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${packet.time}</td>
          <td>${packet.src}</td>
          <td>${packet.dst}</td>
          <td>${packet.proto}</td>
        `;
        tableBody.appendChild(row);
      });
    })
    .catch(error => console.error('Error fetching packets:', error));
}

document.getElementById('protocolFilter').addEventListener('input', fetchPackets);
document.getElementById('srcFilter').addEventListener('input', fetchPackets);
document.getElementById('dstFilter').addEventListener('input', fetchPackets);



function updatePacketCount() {
  fetch('/api/packet_count')
    .then(response => response.json())
    .then(data => {
      document.getElementById('packet-count').textContent = data.total;
    })
    .catch(error => console.error('Error fetching packet count:', error));
}

let timeLabels = [];
let packetCounts = [];
let protocolCounts = { TCP: 0, UDP: 0, ICMP: 0 };
let protocolHistory = {};

const packetCountCtx = document.getElementById('packetCountChart').getContext('2d');

const packetChart = new Chart(packetCountCtx, {
  type: 'line',
  data: {
    labels: timeLabels,
    datasets: [{
      label: 'Packets over Time',
      data: packetCounts,
      borderColor: 'lime',
      backgroundColor: 'rgba(0,255,0,0.1)',
      tension: 0.3
    }]
  },
  options: {
    scales: {
      x: { ticks: { color: '#ccc' } },
      y: { ticks: { color: '#ccc' }, beginAtZero: true }
    },
    plugins: {
      legend: { labels: { color: '#ccc' } }
    }
  }
});

let dynamicProtocolCounts = {};

const protocolCtx = document.getElementById('protocolChart').getContext('2d');
const protocolChart = new Chart(protocolCtx, {
  type: 'bar',
  data: {
    labels: [],
    datasets: [{
      label: 'Protocol Count',
      data: [],
      backgroundColor: [],
    }]
  },
  options: {
    scales: {
      x: { ticks: { color: '#ccc' } },
      y: { ticks: { color: '#ccc' }, beginAtZero: true }
    },
    plugins: {
      legend: { labels: { color: '#ccc' } }
    }
  }
});

let tcpCounts = [];
let udpCounts = [];
let icmpCounts = [];

const protocolOverTimeCtx = document.getElementById('protocolOverTimeChart').getContext('2d');

const protocolOverTimeChart = new Chart(protocolOverTimeCtx, {
  type: 'line',
  data: {
    labels: timeLabels,
    datasets: [] // Start empty; dynamically filled
  },
  options: {
    scales: {
      x: { ticks: { color: '#ccc' } },
      y: { ticks: { color: '#ccc' }, beginAtZero: true }
    },
    plugins: {
      legend: { labels: { color: '#ccc' } }
    }
  }
});



setInterval(() => {
  fetchPackets();
  updatePacketCount();

  fetch('/api/packets')
    .then(res => res.json())
    .then(data => {
      const now = new Date();
      const label = now.toLocaleTimeString();

      timeLabels.push(label);
      if (timeLabels.length > 20) timeLabels.shift();

      packetCounts.push(data.length);
      if (packetCounts.length > 20) packetCounts.shift();
      packetChart.update();

      dynamicProtocolCounts = {}; // reset every interval

      data.forEach(pkt => {
        const proto = pkt.proto.toUpperCase();
        if (!dynamicProtocolCounts[proto]) {
          dynamicProtocolCounts[proto] = 0;
        }
        dynamicProtocolCounts[proto]++;
      });

      // Extract protocols and counts
      const dynamicProtocols = Object.keys(dynamicProtocolCounts);
      const dynamicCounts = Object.values(dynamicProtocolCounts);

      // Generate colors if needed
      const dynamicColors = dynamicProtocols.map((_, i) => {
        const colors = ['#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];
        return colors[i % colors.length]; // Reuse colors if many protocols
      });

      // Update chart
      protocolChart.data.labels = dynamicProtocols;
      protocolChart.data.datasets[0].data = dynamicCounts;
      protocolChart.data.datasets[0].backgroundColor = dynamicColors;
      protocolChart.update();

     Object.keys(dynamicProtocolCounts).forEach(proto => {
  if (!protocolHistory[proto]) {
    protocolHistory[proto] = [];
  }
  protocolHistory[proto].push(dynamicProtocolCounts[proto]);

  if (protocolHistory[proto].length > 20) {
    protocolHistory[proto].shift();
  }
});

      // Ensure all known protocols are extended with 0 if missing
      Object.keys(protocolHistory).forEach(proto => {
        if (!dynamicProtocolCounts[proto]) {
          protocolHistory[proto].push(0);
          if (protocolHistory[proto].length > 20) {
            protocolHistory[proto].shift();
          }
        }
      });

      // Build datasets dynamically
      const colors = ['#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];
      const datasets = Object.keys(protocolHistory).map((proto, i) => ({
        label: proto,
        data: protocolHistory[proto],
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '33', // slightly transparent
        tension: 0.3
      }));

      protocolOverTimeChart.data.datasets = datasets;
      protocolOverTimeChart.update();
    });
}, 2000);

document.getElementById('export-btn').addEventListener('click', () => {
  const table = document.getElementById('packet-table');
  let csv = 'Time,Source IP,Destination IP,Protocol\n';

  Array.from(table.rows).forEach(row => {
    const cells = Array.from(row.cells).map(cell => `"${cell.textContent.trim()}"`);
    csv += cells.join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'network_traffic_data.csv';
  a.click();

  URL.revokeObjectURL(url);
});
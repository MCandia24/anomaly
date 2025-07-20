
    // 1. Map Initialization
    const map = L.map('map').setView([40.7128, -74.0060], 12); // Center on New York with zoom 12

    // OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Global variables to store data and control state
    let allData = []; // Stores all loaded anomaly data
    let filteredData = []; // Stores data after applying filters (date, etc.)
    let realTimeInterval;
    let isRealTimeActive = false; // Flag to track real-time mode
    let timeAxis = []; // Array of unique sorted timestamps for the date slider
    let heatLayer; // heatmap puro
    let tooltipLayer; // capa de marcadores con tooltip
    let anomalyTooltipLayer; // Capa para markers de tooltips
    let heatmapAnomalousLayer;
    let heatmapNormalLayer;

    let hexagonLayer; // Capa para hexágonos H3

    // Get references to control elements
    const radiusControl = document.getElementById('radius-control');
    const opacityControl = document.getElementById('opacity-control');
    const dateControl = document.getElementById('date-control'); // Reference to the date range slider
    //const realTimeBtn = document.getElementById('real-time-btn');
    const radiusValueSpan = document.getElementById('radius-value');
    const opacityValueSpan = document.getElementById('opacity-value');
    const dateValueSpan = document.getElementById('date-value'); // Span to display current date

    const dateInput = document.getElementById('date-value');
    const timeInput = document.getElementById('startTime');

    /**
     * Loads anomaly data from a JSON endpoint.
     * If the fetch fails, it falls back to generating dummy data.
     */
    async function loadJSONData() {
      try {
        const res = await fetch('http://127.0.0.1:8001/api/uber-trips');
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();

        const MAX_POINTS = 10000; // Maximum number of points to extract
        const anomalousRaw = data?.anomalous?.data ?? [];
        const anomalousTime = data?.anomalous?.time_index ?? [];
        const normalRaw = data?.non_anomalous?.data ?? [];
        const normalTime = data?.non_anomalous?.time_index ?? [];

        // Map raw data to structured anomaly objects
        const anomalous = extractPoints(anomalousRaw, MAX_POINTS).map(([lat, lng], i) => ({
          lat, lng,
          value: 10, // Higher value for anomalies for heatmap intensity
          type: 'Anomalía',
          level: 'critical',
          timestamp: new Date(anomalousTime[i % anomalousTime.length] ?? Date.now()),
          message: `Anomalía detectada el ${anomalousTime[i % anomalousTime.length] ?? 'desconocido'}`
        }));

        const normal = extractPoints(normalRaw, MAX_POINTS).map(([lat, lng], i) => ({
          lat, lng,
          value: 2, // Lower value for normal data
          type: 'Normal',
          level: 'info',
          timestamp: new Date(normalTime[i % normalTime.length] ?? Date.now()),
          message: `Dato normal detectado el ${normalTime[i % normalTime.length] ?? 'desconocido'}`
        }));

        allData = [...anomalous, ...normal]; // Combine all data
      
       

      } catch (err) {
        console.error('Error al cargar payload.json, generando datos de respaldo:', err);
        allData = generateAnomalyData(); // Fallback to dummy data
      } finally {
        // Sort allData by timestamp to find min/max dates easily and populate timeAxis
        allData.sort((a, b) => a.timestamp - b.timestamp);
        // Create a time axis with unique sorted timestamps
        timeAxis = [...new Set(
          allData.map(a => a.timestamp.getTime())
        )].sort((a, b) => a - b).map(t => new Date(t));

        // Set initial range for the date slider
        dateControl.max = timeAxis.length === 0 ? 0 : timeAxis.length - 1;
        dateControl.value = timeAxis.length === 0 ? 0 : timeAxis.length - 1; // Default to "Todas" (all data)
        dateValueSpan.textContent = 'Todas';

        applyFilters(); // Apply initial filters
      }
    }

    // Function to generate dummy data (as a fallback)
    function generateAnomalyData() {
      const anomalies = [];
      const types = ['Intrusión', 'Error', 'Comportamiento', 'Acceso'];
      const levels = ['critical', 'warning', 'info'];

      for (let i = 0; i < 50; i++) {
        const lat = 40.7128 + (Math.random() * 0.1 - 0.05); // New York ±0.05 degrees
        const lng = -74.0060 + (Math.random() * 0.01 - 0.005);
        const value = Math.floor(Math.random() * 10) + 1;
        const type = types[Math.floor(Math.random() * types.length)];
        const level = levels[Math.floor(Math.random() * levels.length)];

        anomalies.push({
          lat,
          lng,
          value,
          type,
          level,
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last 7 days
          message: `${type} detectado en ubicación ${i + 1}`
        });
      }
      return anomalies;
    }

    /**
     * Main function to apply all active filters (date, radius, opacity) to the data.
     * Updates the heatmap, charts, and stats based on the filtered data.
     */


function applyFilters() {
  let currentData = [...allData];
const selectedDate = dateInput.value;
const selectedTime = timeInput.value;

  let filterTimestamp = null;
if (selectedDate && selectedTime) {
  filterTimestamp = new Date(`${selectedDate}T${selectedTime}`);
} else if (selectedDate) {
  filterTimestamp = new Date(`${selectedDate}T00:00`); // Si no hay hora, usar medianoche
}


if (filterTimestamp) {
  currentData = currentData.filter(d => d.timestamp <= filterTimestamp);
  dateValueSpan.textContent = filterTimestamp.toLocaleString('es-PE', {
    dateStyle: 'short', timeStyle: 'short'
  });
} else {
  dateValueSpan.textContent = 'Todas';
}

  filteredData = currentData;

  const radius = parseInt(radiusControl.value);
  const opacity = parseFloat(opacityControl.value);


/*
  // Eliminar capas anteriores
  if (heatLayer) map.removeLayer(heatLayer);
  if (tooltipLayer) map.removeLayer(tooltipLayer);

  // Construir capa heatmap
  
  const heatData1 = filteredData.map(nomaly => [nomaly.lat, nomaly.lng, nomaly.v]);
  heatLayer = L.heatLayer(heatData1, {
    radius,
    maxZoom: 18,
    max: 10,
    blur: 15,
    gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' },
    opacity
  }).addTo(map);
/*
  
  const heatData = filteredData.map(anomaly => [anomaly.lat, anomaly.lng, anomaly.value]);
  heatLayer = L.heatLayer(heatData, {
    radius,
    maxZoom: 18,
    max: 10,
    blur: 15,
    gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' },
    opacity
  }).addTo(map);

  // Construir capa de tooltips solo para anomalías
  tooltipLayer = L.layerGroup();
 filteredData.forEach(d => {
  const marker = L.circleMarker([d.lat, d.lng], {
    radius: d.level === 'info' ? 5 : 5,
    color: d.level === 'critical' ? '#900' :
           d.level === 'warning' ? 'orange' : 'green',
    fillColor: d.level === 'critical' ? '#f00' :
               d.level === 'warning' ? '#fc0' : '#0f0',
    fillOpacity: 0.5,
    
    weight: 1
  });

  marker.bindTooltip(
    `<strong>${d.message}</strong><br><strong>Lat:</strong> ${d.lat}<br><strong>Lng:</strong> ${d.lng}<br><strong>Nivel:</strong> ${d.level}`,
    {
      permanent: false,
      direction: 'top',
      offset: [0, -5],
      opacity: 0.9
    }
  );

  tooltipLayer.addLayer(marker);
 
});

  tooltipLayer.addTo(map); */

  //--------------------

// Separar anomalías y normales

  const anomalousData = filteredData
    .filter(d => d.level === 'critical' || d.level === 'warning')
    .map(d => [d.lat, d.lng, d.value]);

  const normalData = filteredData
    .filter(d => d.level === 'info')
    .map(d => [d.lat, d.lng, d.value]);



  // Luego sigues con crear las capas
 

// Primero la capa de normales (fondo)
heatmapNormalLayer = L.heatLayer(normalData, {
  radius,
  maxZoom: 12,
  max: 5,
  blur: 8,
 // gradient: { 0.2: 'lightgreen', 0.4: 'lime', 0.7: 'green' },
 //gradient: { 0.4: 'lightgreen', 0.6: 'lime', 1.0: 'green' },
//gradient: { 1: 'lightgreen', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' },
//gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'lightgreen', 1.0: 'green' },
  // gradient: { 0.4: 'orange', 0.6: 'lime', 0.8: 'lightgreen', 1.0: 'green' },
   gradient: { 0.4: 'blue', 0.6: 'lime', 1.0: 'yellow' },
  opacity: opacity  // más bajo aún
}).addTo(map);



// Luego capa de anomalías (por encima)
heatmapAnomalousLayer = L.heatLayer(anomalousData, {
  radius,
  maxZoom: 16,
  max: 10,
  blur: 15,
  //gradient: { 0.3: 'orange', 0.6: 'red', 1.0: '#8B0000' },
  //gradient: { 0.4: 'orange', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' },
   gradient: { 0.8: 'red', 1.0: 'red' },
   //   gradient: { 1.0: 'red' },
  opacity: opacity // total
}).addTo(map);


if (anomalyTooltipLayer) {
  map.removeLayer(anomalyTooltipLayer); // Quita los antiguos
}
anomalyTooltipLayer = L.layerGroup(); // Nueva capa vacía

function jitter(value) {
  return value + (Math.random() - 0.5) * 0.0003; // Ruido leve
}

filteredData
  .filter(d => d.level === 'critical' || d.level === 'warning')
  .forEach((d, i) => {
    const lat = jitter(d.lat);
    const lng = jitter(d.lng);

    const marker = L.circleMarker([lat, lng], {
      radius: 4,
      color: 'blue',
      fillColor: 'blue',
      fillOpacity: 0.5,
      weight: 1
    });

    marker.bindTooltip(`<strong>${d.message}</strong><br><strong>Lat:</strong> ${d.lat}<br><strong>Lng:</strong> ${d.lng}<br><strong>Nivel:</strong> ${d.level}`, {
      permanent: false,
      direction: 'top',
      offset: [0, -5],
      opacity: 0.9
    });

    anomalyTooltipLayer.addLayer(marker);
  });


anomalyTooltipLayer.addTo(map); // <-- Esto está bien
//------------------------
  // Actualizar estadísticas, gráficos y alertas
  updateStats(filteredData);
  updateCharts(filteredData);
  updateAlertList(filteredData);
}

    /**
     * Updates the statistics cards in the sidebar.
     * @param {Array} data - The data to use for calculating statistics.
     */
    function updateStats(data) {
      const critical = data.filter(a => a.level === 'critical').length;
      const warning = data.filter(a => a.level === 'warning').length;
      const total = data.length;
      const normalPercentage = total > 0 ? Math.round((total - critical - warning) / total * 100) : 0;

      document.getElementById('critical-count').textContent = critical;
      document.getElementById('warning-count').textContent = total;
      document.getElementById('normal-count').textContent = `${normalPercentage}%`;
    }

    /**
     * Updates the time series and distribution charts.
     * @param {Array} data - The data to use for charting.
     */
    function updateCharts(data) {
      // Group by hour of the day for the time series chart
      const hours = {};
      data.forEach(anomaly => {
        const hour = anomaly.timestamp.getHours();
        hours[hour] = hours[hour] || { normal: 0, anomalous: 0 };

        if (anomaly.level === 'critical' || anomaly.level === 'warning') {
          hours[hour].anomalous++;
        } else {
          hours[hour].normal++;
        }
      });

      const timeLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      const normalTimeData = timeLabels.map((_, i) => hours[i]?.normal || 0);
      const anomalyTimeData = timeLabels.map((_, i) => hours[i]?.anomalous || 0);

      // Time Series Chart
      const timeCtx = document.getElementById('timeSeriesChart').getContext('2d');
      if (window.timeChart) {
        window.timeChart.destroy(); // Destroy previous chart instance
      }

      window.timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [{
            label: 'Eventos normales',
            data: normalTimeData,
            borderColor: 'rgba(75, 192, 192, 1)',
            tension: 0.1,
            fill: false
          }, {
            label: 'Anomalías',
            data: anomalyTimeData,
            borderColor: 'rgba(255, 99, 132, 1)',
            tension: 0.1,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: {
                display: true,
                text: 'Hora del día'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Número de eventos'
              },
              beginAtZero: true
            }
          }
        }
      });

      // Distribution Chart (anomalies vs. normal)
      const typeCtx = document.getElementById('distributionChart').getContext('2d');
      const anomalousCount = data.filter(a => a.level === 'critical' || a.level === 'warning').length;
      const normalCount = data.length - anomalousCount;

      if (window.typeChart) {
        window.typeChart.destroy(); // Destroy previous chart instance
      }

      window.typeChart = new Chart(typeCtx, {
        type: 'doughnut',
        data: {
          labels: ['Anomalías', 'Normales'],
          datasets: [{
            data: [anomalousCount, normalCount],
            backgroundColor: [
              '#dc3545', // Red for anomalies
              '#28a745'  // Green for normal
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom' // Place legend at the bottom
            }
          }
        }
      });
    }

    /**
     * Updates the list of recent alerts in the sidebar.
     * @param {Array} data - The data to use for alerts.
     */
    function updateAlertList(data) {
      const alertList = document.getElementById('alert-list');
      alertList.innerHTML = '';

      // Sort by timestamp (most recent first) and filter for critical/warning
      const sortedAnomalies = [...data]
        .sort((a, b) => b.timestamp - a.timestamp)
        .filter(a => a.level === 'critical' || a.level === 'warning')
        .slice(0, 10); // Show only the 5 most recent

      if (sortedAnomalies.length === 0) {
        alertList.innerHTML = '<p class="text-muted">No hay alertas recientes.</p>';
      } else {
        sortedAnomalies.forEach(anomaly => {
          const alertDiv = document.createElement('div');
          alertDiv.className = `anomaly-alert ${anomaly.level === 'critical' ? '' : 'warning'}`;
          const formattedDate = anomaly.timestamp.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
         // alertDiv.innerHTML = `<strong>${anomaly.type}</strong>: ${anomaly.message} <br><small>${formattedDate}</small>`;
          alertDiv.innerHTML = `<strong>${anomaly.type}</strong>: ${anomaly.message}`;
          alertList.appendChild(alertDiv);
        });
      }
    }

    /**
     * Starts or stops the real-time data simulation.
     * When active, new anomalies are continuously added to allData.
     */
    /*function toggleRealTime() {
      if (isRealTimeActive) {
        clearInterval(realTimeInterval);
        realTimeInterval = null;
        realTimeBtn.textContent = 'Activar tiempo real';
        isRealTimeActive = false;
        // Re-enable date control when real-time is off
        dateControl.disabled = false;
        applyFilters(); // Re-apply filters including date filter
      } else {
        realTimeInterval = setInterval(() => {
          // Add a new anomaly (based on existing data for variety)
          if (allData.length > 0) {
            const randomAnomaly = allData[Math.floor(Math.random() * allData.length)];
            const newAnomaly = {
              lat: randomAnomaly.lat + (Math.random() * 0.01 - 0.005),
              lng: randomAnomaly.lng + (Math.random() * 0.01 - 0.005),
              value: Math.floor(Math.random() * 10) + 1,
              type: randomAnomaly.type,
              level: randomAnomaly.level,
              timestamp: new Date(), // Current timestamp for real-time
              message: `Evento en tiempo real: ${randomAnomaly.type} #${Math.floor(Math.random() * 1000)}`
            };
            allData.push(newAnomaly);

            // Keep allData at a manageable size for performance, e.g., last 500 items
            if (allData.length > 500) {
                allData.sort((a, b) => a.timestamp - b.timestamp); // Keep sorted for min/max
                allData = allData.slice(allData.length - 500);
            }
          }
          // Rebuild timeAxis and reset dateControl for new real-time data
          timeAxis = [...new Set(
            allData.map(a => a.timestamp.getTime())
          )].sort((a, b) => a - b).map(t => new Date(t));
          dateControl.max = timeAxis.length === 0 ? 0 : timeAxis.length - 1;
          dateControl.value = timeAxis.length === 0 ? 0 : timeAxis.length - 1; // Always show latest data
          applyFilters(); // Re-apply filters to show new data
        }, 3000); // Add a new anomaly every 3 seconds

        realTimeBtn.textContent = 'Desactivar tiempo real';
        isRealTimeActive = true;
        // Disable date control when real-time is active
        dateControl.disabled = true;
        applyFilters(); // Initial update for real-time mode
      }
    }*/

    // 7. Event Listeners for Controls
    radiusControl.addEventListener('input', function(e) {
      radiusValueSpan.textContent = e.target.value;
      applyFilters();
    });

    opacityControl.addEventListener('input', function(e) {
      opacityValueSpan.textContent = e.target.value;
      applyFilters();
    });

    //dateControl.addEventListener('input', applyFilters); // Listen to changes on the range slider

    //realTimeBtn.addEventListener('click', toggleRealTime);

    // 8. Initialization - Load data when the script loads
    loadJSONData();

    /**
     * Flattens any structure and returns up to `max` [lat,lng] pairs.
     * Also accepts {lat,lng} objects.
     * @param {Array|Object} raw - The raw data to extract points from.
     * @param {number} max - The maximum number of points to extract.
     * @returns {Array<[number, number]>} An array of [latitude, longitude] pairs.
     */
    function extractPoints(raw, max = MAX_POINTS) {
      const out = [];
      const stack = Array.isArray(raw) ? [...raw] : [raw];

      while (stack.length && out.length < max) {
        const item = stack.pop();

        // Case 1: {lat, lng} object
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const { lat, lng } = item;
          if (Number.isFinite(+lat) && Number.isFinite(+lng)) {
            out.push([+lat, +lng]);
          } else {
            // Deep dive into properties of the containing object
            Object.values(item).forEach(v => stack.push(v));
          }
          continue;
        }

        // Case 2: [lat, lng] pair
        if (Array.isArray(item) && item.length === 2 &&
          Number.isFinite(+item[0]) && Number.isFinite(+item[1])) {
          out.push([+item[0], +item[1]]);
          continue;
        }

        // Case 3: intermediate array -> keep descending
        if (Array.isArray(item)) stack.push(...item);
      }

      return out;
    }
 
let tripss=0;

function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO);

    const opciones = {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    };

    // Obtener fecha formateada completa
    const fechaFormateada = new Intl.DateTimeFormat('es-PE', opciones).format(fecha);

    // Reemplazar "de" por "del" antes del año
    const fechaConDel = fechaFormateada.replace(/ de (\d{4})$/, ' del $1');

    // Capitalizar primera letra
    return fechaConDel.charAt(0).toUpperCase() + fechaConDel.slice(1);
}


async function cargarIndicadores() {
    try {
      const response = await fetch('http://127.0.0.1:8001/api/uber-trips/indicators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date_code: '2014-04-01' })
      });

      if (!response.ok) {
        throw new Error('Error al obtener los indicadores');
      }

      const data = await response.json();

      const result = data.result;
      tripss = data.result.total_trips;

      // Actualiza los valores en la tarjeta
      document.getElementById('monitor').textContent = formatearFecha(result.date);
      document.getElementById('trips').textContent = result.total_trips.toLocaleString();
      document.getElementById('anomalies').textContent = result.total_anomalies.toLocaleString();
     
   // Crear mapa
    const radius = 25;     // Tamaño del área de influencia de cada punto
    const opacity = 0.6;   // Transparencia del heatmap
    const map = L.map('map').setView([40.7128, -74.0060], 12); 

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Generar puntos aleatorios
      function generarPuntos(cantidad) {
        const puntos = [];
        for (let i = 0; i < cantidad; i++) {
          const lat = 40.7128 + (Math.random() - 0.1) * 1;
          const lng = -74.0060 + (Math.random() - 0.1) * 1;
          const intensidad = Math.floor(Math.random() * 10) + 1;
          

     
        
          puntos.push([lat, lng, intensidad]);
        }
        return puntos;
      }

const heat = L.heatLayer(generarPuntos(tripss), {
  radius,       // tamaño de influencia de cada punto
  maxZoom: 13,  // zoom máximo donde el heatmap es visible
  max: 9,       // valor máximo de intensidad
  blur: 8,      // difuminado del borde de cada punto
  gradient: { 0.4: 'orange', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' },
    //    gradient: { 0.4: 'blue', 0.6: 'line', 0.8: 'red', 1.0: 'yellow' },
  opacity: 1   // transparencia global del heatmap
}).addTo(map);


    } catch (error) {
      console.error('Error al cargar indicadores:', error);
    }
  }

  // Ejecutar al cargar la página
  window.addEventListener('DOMContentLoaded', cargarIndicadores);

 

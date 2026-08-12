(function() {
  initSiteHeader({ showBackButton: true });

  if (typeof initNavbarScroll === 'function') initNavbarScroll();
  if (typeof initMobileNavbar === 'function') initMobileNavbar();

  (function() {
    var API_KEY = (typeof CONFIG !== 'undefined' && CONFIG.CONTACT && CONFIG.CONTACT.GOOGLE_MAPS_API_KEY) ? CONFIG.CONTACT.GOOGLE_MAPS_API_KEY : '';

    var map = null;
    var userMarker = null;
    var storeMarker = null;
    var userLocation = null;

    var allowBtn = document.getElementById('allowLocation');
    var denyBtn = document.getElementById('denyLocation');
    var permissionCard = document.getElementById('permissionCard');
    var mapCard = document.getElementById('mapCard');
    var mapContainer = document.getElementById('mapContainer');
    var mapLoading = document.getElementById('mapLoading');
    var locationInfo = document.getElementById('locationInfo');
    var confirmBtn = document.getElementById('confirmLocation');
    var resetBtn = document.getElementById('resetLocation');
    var permissionNote = document.getElementById('permissionNote');
    var latValue = document.getElementById('latValue');
    var lngValue = document.getElementById('lngValue');
    var accuracyValue = document.getElementById('accuracyValue');

    window.initMap = function() {
      var defaultCenter = { lat: -33.1400009, lng: -59.3136349 };

      map = new google.maps.Map(mapContainer, {
        center: defaultCenter,
        zoom: 15,
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#3a1f28' }] },
          { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f0f2' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#fde8ef' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e8f4f0' }] }
        ]
      });

      var storePos = { lat: -33.1400009, lng: -59.3136349 };
      storeMarker = new google.maps.Marker({
        position: storePos,
        map: map,
        title: 'Artesanía Gualeguay',
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'),
          scaledSize: new google.maps.Size(32, 32),
          origin: new google.maps.Point(0, 0),
          anchor: new google.maps.Point(16, 32)
        }
      });

      var storeInfoWindow = new google.maps.InfoWindow({
        content: '<div style="font-family:DM Sans,sans-serif;padding:4px;"><strong>Artesanía Gualeguay</strong><br>San Antonio Norte 473, Gualeguay</div>'
      });
      storeMarker.addListener('click', function() {
        storeInfoWindow.open(map, storeMarker);
      });

      if (mapLoading) mapLoading.style.display = 'none';

      if (userLocation) {
        map.setCenter(userLocation);
        map.setZoom(16);
        if (userMarker) userMarker.setMap(null);
        userMarker = new google.maps.Marker({
          position: userLocation,
          map: map,
          title: 'Tu ubicación',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#d47090',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 3
          },
          animation: google.maps.Animation.DROP
        });
        var circle = new google.maps.Circle({
          strokeColor: '#d47090',
          strokeOpacity: 0.3,
          strokeWeight: 1,
          fillColor: '#d47090',
          fillOpacity: 0.1,
          map: map,
          center: userLocation,
          radius: 50
        });
        var userInfoWindow = new google.maps.InfoWindow({
          content: '<div style="font-family:DM Sans,sans-serif;padding:4px;"><strong>Tu ubicación</strong><br>Precisión: 50m</div>'
        });
        userMarker.addListener('click', function() {
          userInfoWindow.open(map, userMarker);
        });
      }
    };

    function showUserLocation(position) {
      var lat = position.coords.latitude;
      var lng = position.coords.longitude;
      var accuracy = position.coords.accuracy;

      userLocation = { lat: lat, lng: lng };

      latValue.textContent = lat.toFixed(6);
      lngValue.textContent = lng.toFixed(6);
      accuracyValue.textContent = Math.round(accuracy) + ' metros';

      if (map && typeof google !== 'undefined' && google.maps) {
        map.setCenter(userLocation);
        map.setZoom(16);

        if (userMarker) userMarker.setMap(null);

        userMarker = new google.maps.Marker({
          position: userLocation,
          map: map,
          title: 'Tu ubicación',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#d47090',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 3
          },
          animation: google.maps.Animation.DROP
        });

        var circle = new google.maps.Circle({
          strokeColor: '#d47090',
          strokeOpacity: 0.3,
          strokeWeight: 1,
          fillColor: '#d47090',
          fillOpacity: 0.1,
          map: map,
          center: userLocation,
          radius: accuracy
        });

        var userInfoWindow = new google.maps.InfoWindow({
          content: '<div style="font-family:DM Sans,sans-serif;padding:4px;"><strong>Tu ubicación</strong><br>Precisión: ' + Math.round(accuracy) + 'm</div>'
        });
        userMarker.addListener('click', function() {
          userInfoWindow.open(map, userMarker);
        });
      }

      if (locationInfo) locationInfo.style.display = 'flex';
      if (confirmBtn) confirmBtn.style.display = 'inline-block';
      if (mapLoading) mapLoading.style.display = 'none';
    }

    function requestGeolocation() {
      if (!navigator.geolocation) {
        permissionNote.textContent = 'Tu navegador no soporta geolocalización.';
        permissionNote.style.color = '#dc2626';
        if (mapLoading) mapLoading.style.display = 'none';
        return;
      }

      permissionNote.textContent = 'Solicitando permiso de ubicación...';
      permissionNote.style.color = 'var(--text-mid)';

      if (mapLoading) mapLoading.style.display = 'flex';

      navigator.geolocation.getCurrentPosition(
        showUserLocation,
        function(error) {
          var message = 'No se pudo obtener la ubicación.';
          if (error.code === 1) {
            message = 'Permiso de ubicación denegado. Podés volver a intentar más abajo.';
          } else if (error.code === 2) {
            message = 'Ubicación no disponible. Verificá tu conexión.';
          } else if (error.code === 3) {
            message = 'Tiempo de espera agotado. Intentá de nuevo.';
          }
          permissionNote.textContent = message;
          permissionNote.style.color = '#dc2626';
          if (mapLoading) mapLoading.style.display = 'none';
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    function loadGoogleMaps() {
      if (!API_KEY) {
        if (mapContainer) {
          mapContainer.innerHTML = '<iframe src="https://www.google.com/maps?q=San+Antonio+Norte+473,+Gualeguay,+Entre+R%C3%ADos,+Argentina&output=embed" width="100%" height="400" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa del local - Artesanía Gualeguay" class="map-iframe"></iframe>';
        }
        return;
      }

     if (typeof google !== 'undefined' && google.maps) {
       initMap();
       return;
     }

     var existing = document.querySelector('script[src*="maps.googleapis.com"]');
     if (existing) return;

     var script = document.createElement('script');
     script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(API_KEY) + '&callback=initMap';
     script.async = true;
     script.defer = true;
     script.onerror = function() {
       if (mapLoading) mapLoading.innerHTML = '<p style="color:var(--text-muted);">No se pudo cargar Google Maps. Verificá tu conexión.</p>';
     };
     document.head.appendChild(script);
   }

   function showMapCard() {
     if (permissionCard) permissionCard.style.display = 'none';
     if (mapCard) mapCard.style.display = 'block';

     setTimeout(function() {
       if (map && typeof google !== 'undefined' && google.maps) {
         google.maps.event.trigger(map, 'resize');
         if (userLocation) {
           map.setCenter(userLocation);
           map.setZoom(16);
         } else {
           map.setCenter({ lat: -33.1400009, lng: -59.3136349 });
           map.setZoom(15);
         }
       }
     }, 100);
   }

    function init() {
      if (allowBtn) {
        allowBtn.addEventListener('click', function() {
          showMapCard();
          loadGoogleMaps();
          requestGeolocation();
        });
      }

      if (denyBtn) {
        denyBtn.addEventListener('click', function() {
          showMapCard();
          permissionNote.textContent = 'No se compartió la ubicación. Podés ingresar tu dirección manualmente en el checkout.';
          permissionNote.style.color = 'var(--text-mid)';
          loadGoogleMaps();
          if (mapLoading) mapLoading.style.display = 'none';
          if (confirmBtn) confirmBtn.style.display = 'inline-block';
        });
      }

      if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
          if (userLocation) {
            showToast('', 'Ubicación confirmada: ' + userLocation.lat.toFixed(4) + ', ' + userLocation.lng.toFixed(4), 'success');
          } else {
            showToast('', 'Ubicación del local confirmada', 'success');
          }
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', function() {
          if (mapCard) mapCard.style.display = 'none';
          if (permissionCard) permissionCard.style.display = 'block';
          if (permissionNote) {
            permissionNote.textContent = '';
            permissionNote.style.color = '';
          }
          if (locationInfo) locationInfo.style.display = 'none';
          if (confirmBtn) confirmBtn.style.display = 'none';
          if (userMarker && map) userMarker.setMap(null);
          userLocation = null;
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
})();

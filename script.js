let map;
let geocoder;
let infoWindow;
let markers = [];

async function initMap() {
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const { Place } = await google.maps.importLibrary("places");
  const { Geocoder } = await google.maps.importLibrary("geocoding");

  map = new Map(document.getElementById("map"), {
    center: { lat: 39.7279232, lng: -104.972288 },
    zoom: 12,
    mapId: "DEMO_MAP_ID",
    gestureHandling: "greedy",
  });

  geocoder = new Geocoder();
  infoWindow = new InfoWindow();

  document.getElementById("search-button").addEventListener("click", performSearch);
}

async function performSearch() {
  const query = document.getElementById("query-input").value;
  const location = document.getElementById("location-input").value;
  const messageBox = document.getElementById("message-box");

  clearResults();

  if (!location) {
    messageBox.textContent = "Please enter a location.";
    messageBox.style.display = "block";
    return;
  }
  if (!query) {
    messageBox.textContent = "Please enter what you are looking for.";
    messageBox.style.display = "block";
    return;
  }

  messageBox.textContent = "Searching...";
  messageBox.style.display = "block";

  try {
    const geocodeResult = await geocoder.geocode({ address: location });
    if (geocodeResult.results && geocodeResult.results.length > 0) {
      const locationGeometry = geocodeResult.results[0].geometry;
      map.fitBounds(locationGeometry.viewport);

      const { Place } = await google.maps.importLibrary("places");
      const request = {
        textQuery: query,
        fields: ["displayName", "location", "formattedAddress"],
        locationRestriction: locationGeometry.viewport,
      };

      const { places } = await Place.searchByText(request);

      if (places.length) {
        messageBox.style.display = "none";
        displayResults(places);
      } else {
        messageBox.textContent = "No results found in the specified area.";
      }
    } else {
      messageBox.textContent = "Could not find the specified location.";
    }
  } catch (error) {
    console.error("Search failed:", error);
    messageBox.textContent = "An error occurred during the search.";
  }
}

function clearResults() {
  markers.forEach((marker) => {
    marker.map = null;
  });
  markers = [];
  document.getElementById("results-list").innerHTML = "";
  document.getElementById("message-box").style.display = "none";
  infoWindow.close();
}

function displayResults(places) {
  const resultsList = document.getElementById("results-list");
  const bounds = new google.maps.LatLngBounds();

  places.forEach((place) => {
    const marker = createMarker(place);
    bounds.extend(place.location);

    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <div class="place-name">${place.displayName}</div>
      <div class="place-address">${place.formattedAddress}</div>
    `;
    listItem.addEventListener("click", () => {
      google.maps.event.trigger(marker, "click");
    });
    resultsList.appendChild(listItem);
  });

  if (places.length > 1) {
      map.fitBounds(bounds);
  } else if (places.length === 1) {
      map.setCenter(places[0].location);
      map.setZoom(15);
  }
}

function createMarker(place) {
  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position: place.location,
    title: place.displayName,
  });

  marker.addListener("click", () => {
    infoWindow.setContent(`
      <div><strong>${place.displayName}</strong></div>
      <div>${place.formattedAddress}</div>
    `);
    infoWindow.open(map, marker);
    map.panTo(place.location);
  });

  markers.push(marker);
  return marker;
}

initMap();
import { parseOpenStreetMap } from 'functions/parsing/parseOpenStreetMap';
import { parseGoogleLink } from 'functions/parsing/parseGoogleLink';
import { parseBingCoords } from 'functions/parsing/parseBingCoords';
import { parseHereWeGo } from 'functions/parsing/parseHereWeGo';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { lang } from 'services/translator';
import { idObj } from 'services/dom/idObj';
import { env } from 'settings/env';
import * as L from 'leaflet';

function getNavigator() {
  try {
    return navigator || window.navigator;
  } catch (e) {
    return undefined;
  }
}

export function getLatLong({ coords, callback }) {
  let zoom = 16;

  if (!coords?.latitude || !coords?.longitude) {
    coords = { latitude: 0, longitude: 0 };
    zoom = 2;
  }

  let ids = {
    map: 'latLongMap',
    link: 'latLonglink',
  };

  let map_style = 'width: 100%; height: 100%; min-width: 350px; min-height: 350px;';
  let html = `
         <div style='min-height: 150px'>
         <h2 class='tmx-title'>Enter map URL</h2>
         <div class='flexcenter'>${lang.tr('phrases.addgooglemap')}</div>
         <div class='flexcenter flexcol'>
            <input id='${ids.link}' value='' style='text-align: center; width: 25em; margin: 1em;'>
            <div class='flexrow' style='margin-top: 1em; margin-bottom: 1em;'>
            </div>
         </div>
         <div class='location_detail_body' style='min-width: 350px; min-height: 350px;'>
            <div id='${ids.map}' class='location_map' style='${map_style}'>
         </div>
      `;

  const viewLocation = () => {
    if (!coords.latitude || !coords.longitude) {
      processLink();
    } else {
      updateCoords(coords);
    }
  };

  const submitLink = () => {
    if (!coords.latitude || !coords.longitude) processLink();
    if (isFunction(callback)) {
      callback(coords);
    }
  };

  const buttons = [
    {
      label: 'Cancel',
      intent: 'none',
      close: true,
    },
    {
      onClick: updateCoords,
      intent: 'is-warning',
      label: 'Clear',
    },
    {
      onClick: viewLocation,
      intent: 'is-primary',
      label: 'View',
      close: false,
    },
    {
      onClick: submitLink,
      intent: 'is-info',
      label: 'Submit',
      close: true,
    },
  ];

  const processLink = () => {
    const link = container.link.element.value;
    const parsedCoords =
      parseGoogleLink(link) || parseBingCoords(link) || parseOpenStreetMap(link) || parseHereWeGo(link);

    if (parsedCoords.latitude) {
      updateCoords(parsedCoords);
    } else if (link && parsedCoords.latitude === undefined) {
      tmxToast({ message: 'Invalid URL' });
    }
  };

  const linkKeyEvent = (evt) => {
    if (evt.which === 13) processLink();
  };

  openModal({ content: html, buttons });

  const container = idObj(ids);
  let { map, marker } = locationMap({
    successElement: container.map.element,
    mapElementId: container.map.id,
    coords,
    zoom,
  });
  container.link.element.value = '';
  container.link.element.focus();
  container.link.element.addEventListener('keyup', linkKeyEvent);

  if (map) {
    map.on('click', (e) => updateMarker({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
    map.on('contextmenu', (e) => console.log('Coordinates: ' + e.latlng.toString()));
  }

  function updateMarker({ latitude, longitude }) {
    coords = { latitude, longitude };
    let newLatLng = new L.LatLng(latitude, longitude);
    marker.setLatLng(newLatLng);
  }

  function updateCoords({ latitude = 0, longitude = 0 } = {}) {
    if (latitude && longitude) {
      coords = { latitude: +latitude, longitude: +longitude };
      map.setView([+latitude, +longitude], 16);
      return true;
    } else {
      coords = { latitude: 0, longitude: 0 };
      map.fitWorld();
    }
  }
}

function locationMap({ successElement, mapElementId, coords, zoom }) {
  let nav = getNavigator();
  if (!nav?.onLine) return {};

  zoom = zoom === undefined ? 16 : zoom;
  if (coords.latitude !== undefined && coords.longitude !== undefined) {
    if (successElement) successElement.style.display = 'inline';
    return gpsLocation(coords.latitude, coords.longitude, zoom);
  } else {
    return {};
  }

  function gpsLocation(lat, lng, zoom) {
    if (isNaN(lat) || isNaN(lng)) return {};
    let view = env.locations.map_view || 'map';
    let layer = L.tileLayer(env.leaflet[view].tileLayer, {
      // attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      attribution: env.leaflet[view].attribution,
      maxZoom: env.leaflet[view].maxZoom ?? 16,
    });
    let map = L.map(mapElementId).fitWorld().addLayer(layer);
    if (lat || lng) map.setView([+lat, +lng], zoom);

    let marker = L.marker([+lat, +lng]).addTo(map);

    // necessary to make the map fill the parent element
    setTimeout(function () {
      map.invalidateSize();
    }, 300);

    return { map, marker };
  }
}

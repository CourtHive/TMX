/**
 * Get latitude/longitude modal with map interface.
 * Accepts map URLs from multiple providers and allows interactive marker placement.
 */
import { parseOpenStreetMap } from 'functions/parsing/parseOpenStreetMap';
import { locationConfig, leafletConfig } from 'config/locationConfig';
import { parseGoogleLink } from 'functions/parsing/parseGoogleLink';
import { parseBingCoords } from 'functions/parsing/parseBingCoords';
import { parseHereWeGo } from 'functions/parsing/parseHereWeGo';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { idObj } from 'services/dom/idObj';
import * as L from 'leaflet';
import { t } from 'i18n';

function getNavigator() {
  try {
    return navigator || globalThis.navigator;
  } catch (e) {
    // Navigator not available
    console.log(e);
    return undefined;
  }
}

type Coords = {
  latitude: number;
  longitude: number;
};

export function getLatLong({ coords, callback }: { coords?: Coords; callback?: (coords: Coords) => void }): void {
  let zoom = 16;

  if (!coords?.latitude || !coords?.longitude) {
    coords = { latitude: 0, longitude: 0 };
    zoom = 2;
  }

  const ids = {
    map: 'latLongMap',
    link: 'latLonglink',
  };

  const map_style = 'width: 100%; height: 100%; min-width: 350px; min-height: 350px;';
  const html = `
    <div style='min-height: 150px'>
    <h2 class='tmx-title'>${t('modals.getLatLong.enterMapUrl')}</h2>
    <div class='flexcenter'>${t('phrases.addgooglemap')}</div>
    <div class='flexcenter flexcol'>
      <input id='${ids.link}' value='' style='text-align: center; width: 25em; margin: 1em;'>
      <div class='flexrow' style='margin-top: 1em; margin-bottom: 1em;'>
      </div>
    </div>
    <div class='location_detail_body' style='min-width: 350px; min-height: 350px;'>
      <div id='${ids.map}' class='location_map' style='${map_style}'>
    </div>
  </div>`;

  const viewLocation = () => {
    if (!coords!.latitude || !coords!.longitude) {
      processLink();
    } else {
      updateCoords(coords);
    }
  };

  const submitLink = () => {
    if (!coords!.latitude || !coords!.longitude) processLink();
    if (isFunction(callback) && callback) {
      callback(coords!);
    }
  };

  const buttons = [
    {
      label: t('common.cancel'),
      intent: 'none',
      close: true,
    },
    {
      onClick: updateCoords,
      intent: 'is-warning',
      label: t('clr'),
    },
    {
      onClick: viewLocation,
      intent: 'is-primary',
      label: t('view'),
      close: false,
    },
    {
      onClick: submitLink,
      intent: 'is-info',
      label: t('common.submit'),
      close: true,
    },
  ];

  const processLink = () => {
    const link = (container.link.element as HTMLInputElement)?.value;
    const parsedCoords =
      parseGoogleLink(link) || parseBingCoords(link) || parseOpenStreetMap(link) || parseHereWeGo(link);

    if (parsedCoords.latitude) {
      updateCoords(parsedCoords as any);
    } else if (link && parsedCoords.latitude === undefined) {
      tmxToast({ message: t('modals.getLatLong.invalidUrl') });
    }
  };

  const linkKeyEvent = (evt: KeyboardEvent) => {
    if (evt.key === 'Enter') processLink();
  };

  openModal({ title: t('modals.getLatLong.title'), content: html, buttons });

  const container = idObj(ids);
  let { map, marker } = locationMap({
    successElement: container.map.element,
    mapElementId: container.map.id,
    coords,
    zoom,
  });
  if (container.link.element) {
    (container.link.element as HTMLInputElement).value = '';
    container.link.element.focus();
    container.link.element.addEventListener('keyup', linkKeyEvent);
  }

  if (map) {
    map.on('click', (e: any) => updateMarker({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
    map.on('contextmenu', (e: any) => console.log('Coordinates: ' + e.latlng.toString()));
  }

  function updateMarker({ latitude, longitude }: Coords) {
    coords = { latitude, longitude };
    if (!map) return;
    const newLatLng = new L.LatLng(latitude, longitude);
    if (marker) {
      marker.setLatLng(newLatLng);
    } else {
      marker = L.marker(newLatLng).addTo(map);
    }
  }

  function updateCoords({ latitude = 0, longitude = 0 }: Partial<Coords> = {}): boolean | undefined {
    if (!map) return false;
    if (latitude && longitude) {
      coords = { latitude: +latitude, longitude: +longitude };
      map.setView([+latitude, +longitude], 16);
      updateMarker({ latitude: +latitude, longitude: +longitude });
      return true;
    } else {
      coords = { latitude: 0, longitude: 0 };
      map.fitWorld();
      if (marker) {
        map.removeLayer(marker);
        marker = undefined;
      }
      return false;
    }
  }
}

function locationMap({
  successElement,
  mapElementId,
  coords,
  zoom,
}: {
  successElement: any;
  mapElementId: string;
  coords: Coords;
  zoom: number;
}): { map: any; marker: any } {
  const nav = getNavigator();
  if (!nav?.onLine) return {} as any;

  if (successElement) successElement.style.display = 'inline';

  const view = locationConfig.get().map_view || 'map';
  const leaflet = leafletConfig.get();
  const layer = L.tileLayer(leaflet[view].tileLayer, {
    attribution: leaflet[view].attribution,
    maxZoom: leaflet[view].maxZoom ?? 16,
  });
  const map = L.map(mapElementId).fitWorld().addLayer(layer);

  const hasCoords =
    !!coords.latitude && !!coords.longitude && !Number.isNaN(+coords.latitude) && !Number.isNaN(+coords.longitude);
  let marker: any;
  if (hasCoords) {
    map.setView([+coords.latitude, +coords.longitude], zoom);
    marker = L.marker([+coords.latitude, +coords.longitude]).addTo(map);
  }

  setTimeout(function () {
    map.invalidateSize();
  }, 300);

  return { map, marker };
}

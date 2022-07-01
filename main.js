import "ol/ol.css";
import "bootstrap/dist/css/bootstrap.min.css";

import Map from "ol/Map";

import View from "ol/View";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { transformExtent, transform as transformCoord } from "ol/proj";
import {
  extend as extendExtent,
  buffer as bufferExtent,
  getCenter,
  getBottomLeft,
  getTopRight,
  boundingExtent,
} from "ol/extent";

import XYZ from "ol/source/XYZ";
import TileWMS from "ol/source/TileWMS";
import GeoTIFF from "ol/source/GeoTIFF";
import TileLayer from "ol/layer/Tile";
import WebGLTileLayer from "ol/layer/WebGLTile";

import { fromExtent } from "ol/geom/Polygon";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";

import { Fill, Stroke, Style } from "ol/style";

import { Control, FullScreen, defaults as defaultControls } from "ol/control";

function configBaseMap(mapFallback, cogView) {
  let url = "";

  if (cogView) {
    const epsg = cogView.getProjection().code_.split(":")[1];

    if (["4326", "3857"].includes(epsg)) {
      // EPSG already registered in OpenLayers

      if (mapFallback === "OSM") {
        url = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      } else if (mapFallback === "Satellite") {
        url =
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      } else if (mapFallback === "DEM") {
        url = "https://{a-d}.tiles.mapbox.com/v3/aj.sf-dem/{z}/{x}/{y}.png";
      }
    } else {
      if (epsg === "2056") {
        // CH1903 - Swiss
        url = "http://tile.osm.ch/2056/{z}/{x}/{y}.png";
      } else if (mapFallback === "Satellite") {
        return false;
      }
    }

    return new TileLayer({
      source: new XYZ({
        url: url,
      }),
      minZoom: 1,
      maxZoom: 19,
    });
  } else {
    return new TileLayer({
      extent: [-180, -90, 180, 90],
      source: new TileWMS({
        url: "https://s2maps-tiles.eu/wms",
        params: { LAYERS: "s2cloudless-2020" },
        projection: "EPSG:4326",
        attributions: [
          '<a xmlns: dct="http://purl.org/dc/terms/" href="https://s2maps.eu" property="dct:title">Sentinel-2 cloudless - https://s2maps.eu</a> by <a xmlns:cc="http://creativecommons.org/ns#" href="https://eox.at" property="cc:attributionName" rel="cc:attributionURL">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2020)',
        ],
      }),
    });

    // return new TileLayer({
    //   source: new XYZ({
    //     url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    //   }),
    //   minZoom: 1,
    //   maxZoom: 19
    // });
  }
}

function validUrl(str) {
  let url;

  try {
    url = new URL(str);
  } catch (_) {
    alert(
      "'" + str + "' is not a valid URL. Did you forget to include http://? "
    );
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

function encodeUrlFilename(str) {
  const url = new URL(str);
  const pathname = url.pathname;
  const index = pathname.lastIndexOf("/");
  let encodedPath = "";

  if (index !== -1) {
    const filename = encodeURIComponent(pathname.substring(index + 1));
    const remainder = pathname.substring(0, index + 1);
    encodedPath = remainder + filename;
  } else {
    encodedPath = pathname;
  }

  const cogUrl = `${url.origin}${encodedPath}`;

  return cogUrl;
}

const getCOGDetails = (view) => {
  return [view.projection.code_.split(":")[1], view.center, view.extent];
};

async function getProj4String(epsg) {
  if (["4326", "3857"].includes(epsg)) {
    // EPSG already registered in OpenLayers
    return false;
  }

  const url = `//epsg.io/${epsg}.proj4`;
  const response = await fetch(url);

  if (!response.ok) {
    alert(`HTTP error ${response.status} downloading EPSG ${epsg}`);
  }
  return response.text();
}

function createPolygonFromExtent(extent, cogUrl, cogCenter) {
  const polygon = fromExtent(extent);

  const polygonFeature = new Feature({
    geometry: polygon,
    cogUrl: cogUrl,
    cogCenter: cogCenter,
  });

  const polygonSource = new VectorSource({
    features: [polygonFeature],
  });

  return new VectorLayer({
    source: polygonSource,
    style: new Style({
      stroke: new Stroke({
        color: "blue",
        width: 3,
      }),
      fill: new Fill({
        color: "rgba(0, 0, 255, 0.1)",
      }),
    }),
  });
}

// const variables = {};

// function elevation(xOffset, yOffset) {
//   return [
//     '+',
//     ['*', 256, ['band', 1, xOffset, yOffset]],
//     [
//       '+',
//       ['*', 2 * 256, ['band', 2, xOffset, yOffset]],
//       ['*', 3 * 256, ['band', 3, xOffset, yOffset]],
//     ],
//   ];
// }

// // Generates a shaded relief image given elevation data.  Uses a 3x3
// // neighborhood for determining slope and aspect.
// const dp = ['*', 2, ['resolution']];
// const z0x = ['*', ['var', 'vert'], elevation(-1, 0)];
// const z1x = ['*', ['var', 'vert'], elevation(1, 0)];
// const dzdx = ['/', ['-', z1x, z0x], dp];
// const z0y = ['*', ['var', 'vert'], elevation(0, -1)];
// const z1y = ['*', ['var', 'vert'], elevation(0, 1)];
// const dzdy = ['/', ['-', z1y, z0y], dp];
// const slope = ['atan', ['^', ['+', ['^', dzdx, 2], ['^', dzdy, 2]], 0.5]];
// const aspect = ['clamp', ['atan', ['-', 0, dzdx], dzdy], -Math.PI, Math.PI];
// const sunEl = ['*', Math.PI / 180, ['var', 'sunEl']];
// const sunAz = ['*', Math.PI / 180, ['var', 'sunAz']];

// const cosIncidence = [
//   '+',
//   ['*', ['sin', sunEl], ['cos', slope]],
//   ['*', ['*', ['cos', sunEl], ['sin', slope]], ['cos', ['-', sunAz, aspect]]],
// ];
// const scaled = ['*', 255, cosIncidence];

// const controlIds = ['vert', 'sunEl', 'sunAz'];
// controlIds.forEach(function (id) {
//   const control = document.getElementById(id);
//   const output = document.getElementById(id + 'Out');
//   function updateValues() {
//     output.innerText = control.value;
//     variables[id] = Number(control.value);
//   }
//   updateValues();
//   const listener = function () {
//     updateValues();
//     terrainLayer.updateStyleVariables(variables);
//   };
//   control.addEventListener('input', listener);
//   control.addEventListener('change', listener);
// });

function configCOGLayer(url) {
  const cogSource = new GeoTIFF({
    sources: [
      {
        url: url,
        // nodata: -9999,
      },
    ],
  });

  const cogLayer = new WebGLTileLayer({
    source: cogSource,
    minZoom: 1,
    maxZoom: 19,
    // style: {
    //   variables: variables,
    //   color: ['color', scaled, scaled, scaled],
    // },
    // resolutions: [2048.0, 1024.0, 361.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 0.5],
    // cacheSize: 1024
  });

  return [cogSource, cogLayer];
}

// function configWMSLayer(url) {

//   if (!validUrl(url)) {
//     return false
//   }

//   return new TileLayer({
//     source: new TileWMS({
//       projection: 'EPSG:4326',
//       url: url,
//       params: {
//         'LAYERS': 'ne:NE1_HR_LC_SR_W_DR'
//       }
//     })
//   })

// };

async function getUpdatedMapView(existingView, epsg, center, extent) {
  let combinedExtent = extent;
  let combinedCenter = center;

  if (existingView) {
    if (existingView.getProjection().getCode() !== `EPSG:${epsg}`) {
      alert("COGs cannot have different projections!");
      return;
    }

    combinedExtent = extendExtent(
      existingView.calculateExtent(map.getSize()),
      extent
    );
    combinedCenter = getCenter(combinedExtent);
  } else {
    const proj4String = await getProj4String(epsg);

    if (proj4String) {
      proj4.defs(`EPSG:${epsg}`, proj4String);
      register(proj4);
    }
  }

  return new View({
    projection: `EPSG:${epsg}`,
    center: combinedCenter,
    minZoom: 1,
    maxZoom: 19,
    zoom: 1,
    extent: combinedExtent,
    showFullExtent: true,
    // // smoothExtentConstraint: true,
    // // constrainOnlyCenter: true,
    // // constrainResolution: false,
    // extent: bufferExtent(combinedExtent, 20000),
    // resolutions: [
    //   2048.0,
    //   1024.0,
    //   361.0,
    //   256.0,
    //   128.0,
    //   64.0,
    //   32.0,
    //   16.0,
    //   8.0,
    //   4.0,
    //   2.0,
    //   0.5
    // ]
    // extent: transformExtent([-150,-75,150,75], 'EPSG:4326', 'EPSG:3857')
  });
}

class CycleLayers extends Control {
  /**
   * @param {Object} [opt_options] Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement("button");
    button.innerHTML = "➔";

    const element = document.createElement("div");
    element.className = "cycle-layers ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener("click", this.cycleCOGLayers.bind(this), false);
  }

  cycleCOGLayers() {
    if (Object.keys(cogExtentMap).length < 1) {
      return false;
    }

    const keys = Object.keys(cogExtentMap);
    if (selectedLayerIndex > keys.length - 1) {
      selectedLayerIndex = 0;
    }

    const uid = Object.keys(cogExtentMap)[selectedLayerIndex];
    const extent = cogExtentMap[keys[selectedLayerIndex]];
    map
      .getLayers()
      .getArray()
      .find((layer) => layer.ol_uid == uid);
    map.getView().fit(extent);
    selectedLayerIndex += 1;
  }
}

// class ZoomLevelDisplay extends Control {
//   /**
//    * @param {Object} [opt_options] Control options.
//    */
//   constructor(opt_options) {
//     const options = opt_options || {};

//     const button = document.createElement("button");

//     const element = document.createElement("div");
//     element.className = "zoom-level-display ol-unselectable ol-control";
//     element.appendChild(button);

//     super({
//       element: element,
//       target: options.target
//     });
//   }
// }

async function addUserProvidedCOG(inputUrl) {
  if (!validUrl(inputUrl)) {
    return false;
  }

  // Encode url to remove '+' characters
  const cogUrl = encodeUrlFilename(inputUrl);

  const [cogSource, cogLayer] = configCOGLayer(cogUrl);

  // terrainLayer = cogLayer;

  const [epsg, center, extent] = getCOGDetails(await cogSource.getView());
  cogView = await getUpdatedMapView(cogView, epsg, center, extent);
  cogExtentMap[cogLayer.ol_uid] = extent;

  // TODO need to reconfigure base map and reload, based on cog
  // baseMap = configBaseMap(mapFallback, cogView);
  // layers.unshift(baseMap) ? baseMap : [];

  // map.addLayer(cogLayer);
  // map.setView(cogView);

  const transformedExtent = transformExtent(
    extent,
    `EPSG:${epsg}`,
    "EPSG:4326"
  );
  const transformedCenter = transformCoord(center, `EPSG:${epsg}`, "EPSG:4326");
  const polygonLayer = createPolygonFromExtent(
    transformedExtent,
    cogUrl,
    transformedCenter
  );
  map.addLayer(polygonLayer);
  map.getView().fit(transformedExtent, map.getSize());
}

// START
const button = document.getElementById("cogSubmit");
const urlBox = document.getElementById("cogUrl");
button.addEventListener("click", () => addUserProvidedCOG(urlBox.value));

const mapFallback = "OSM";

// let terrainLayer = null;
let cogView = null;
let cogExtentMap = {};
let selectedLayerIndex = 0;

// // TESTS
// const cogUrl = encodeUrlFilename('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/findelen_20160419/findelen_20160419_photoscan_dsm_CH1903+_LV95_0.1m_COG_deflate.tif');
// // const cogUrl = encodeUrlFilename('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/findelen_20160419/findelen_20160419_photoscan_oi_CH1903+_LV95_0.1m.tif');
// // const cogUrl = encodeUrlFilename('https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/2020/S2A_36QWD_20200701_0_L2A/TCI.tif');
// const [cogSource, cogLayer] = configCOGLayer(cogUrl);
// const [epsg, center, extent] = getCOGDetails(await cogSource.getView());
// cogView = await getUpdatedMapView(cogView, epsg, center, extent);
// cogExtentMap[cogLayer.ol_uid] = extent;

// const baseMap = configBaseMap(mapFallback, cogView);
// const layers = [cogLayer]
// layers.unshift(baseMap) ? baseMap : [];

// map.addLayer(cogLayer);
// map.setView(cogView);

const map = new Map({
  target: "map-container",
  layers: [
    configBaseMap(),
    // baseMap,
    // cogLayer,
  ],
  controls: defaultControls().extend([
    new FullScreen(),
    new CycleLayers(),
    // new ZoomLevelDisplay(),
  ]),
  view: new View({
    projection: "EPSG:4326",
    center: [0, 0],
    zoom: 2,
  }),
  // view: cogView,
});

map.on("click", function (evt) {
  var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    return feature;
  });
  if (feature) {
    const center = feature.get("cogCenter");
    const url = `https://www.cogeo.org/map/#/url/${encodeURIComponent(
      feature.get("cogUrl")
    )}/center/${center}/zoom/15.5`;
    window.open(url, "_blank");
  }
});

// addUserProvidedCOG('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/findelen_20160419/findelen_20160419_photoscan_dsm_CH1903+_LV95_0.1m_COG_deflate.tif')
// addUserProvidedCOG('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/gries_20150926/gries_20150926_photoscan_dsm_CH1903+_LV95_0.1m_COG_deflate.tif')
// addUserProvidedCOG('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/stanna_20150928/stanna_20150928_photoscan_dsm_CH1903+_LV95_0.1m_COG_deflate.tif')

// addUserProvidedCOG('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/findelen_20160419/findelen_20160419_photoscan_oi_CH1903+_LV95_0.1m_COG_jpeg.tif')
// addUserProvidedCOG('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/gries_20150926/gries_20150926_photoscan_oi_CH1903+_LV95_0.1m_COG_jpeg.tif')
// addUserProvidedCOG('https://drone-data.s3-zh.os.switch.ch/wsl/uav-datasets-for-three-alpine-glaciers/stanna_20150928/stanna_20150928_photoscan_oi_CH1903+_LV95_0.1m_COG_jpeg.tif')

// map.getView().on('change:resolution', () => {
//   const zoom = Math.round(map.getView().getZoom());
//   const control = document.getElementsByClassName('zoom-level-display')[0]
//   control.innerHTML = `<button>${zoom}</button>`;
// });

// const mapExtent = cogView.calculateExtent(map.getSize());
// const bottomLeft = getBottomLeft(mapExtent);
// const topRight = getTopRight(mapExtent);
// const baseLayerExtent = boundingExtent([bottomLeft, topRight]);
// map.getView().fit(baseLayerExtent, map.getSize());

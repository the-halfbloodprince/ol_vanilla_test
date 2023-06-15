import './style.css'
import Map from 'ol/Map'
import View from 'ol/View'
import OSM from 'ol/source/OSM'
import Overlay from 'ol/Overlay'
import { fromLonLat } from 'ol/proj'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Draw from 'ol/interaction/Draw'
import MapBrowserEvent from 'ol/MapBrowserEvent'
import { Feature } from 'ol'
import { EventsKey } from 'ol/events'
import { DrawEvent } from 'ol/interaction/Draw'
import { LineString, Polygon } from 'ol/geom'
import { getLength, getArea } from 'ol/sphere'
import Style from 'ol/style/Style'
import CircleStyle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import { Coordinate } from 'ol/coordinate'
import { unByKey,  } from 'ol/Observable'

// the main map canvas
const map = new Map({
  target: 'map',
})

// the view for the map
const view = new View({
  center: fromLonLat([91.7086, 26.1158]),
  zoom: 8
})

// set the view
map.setView(view)

// the basemap -> it's a TileLayer
const baseMapLayer = new TileLayer({
  source: new OSM(), // It's a Open Street Map
})

map.addLayer(baseMapLayer)

const source = new VectorSource()

const vectorlayer = new VectorLayer({
  source,
  style: {
    'fill-color': 'rgba(255, 255, 255, .2)',
    'stroke-color': '#ffcc33',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#ffcc33',
  }
})

map.addLayer(vectorlayer)

let currentSketch: Feature | null
let helpTooltip_Element: HTMLElement
let helpTooltip_Overlay: Overlay
let measureTooltip_Element: HTMLElement | null
let measureTooltip_Overlay: Overlay

const continueDrawingPolygonMsg: string = 'Click to continue drawing the polygon'
const continueDrawingLineMsg: string = 'Click to continue drawing the line'

const pointerMoveHandler = function (evt: MapBrowserEvent<any>) {
  if (evt.dragging) {
    return
  }

  let helpMsg = 'Click to start drawing'
  
  if (currentSketch) {
    const geometry  = currentSketch.getGeometry()
    if (geometry instanceof Polygon) {
      console.log('move', 'polygon')
      helpMsg = continueDrawingPolygonMsg
    } else if (geometry instanceof LineString) {
      console.log('move', 'line')
      helpMsg = continueDrawingLineMsg
    }
  }

  // set the tooltip text and position it
  helpTooltip_Element.innerHTML = helpMsg
  helpTooltip_Overlay.setPosition(evt.coordinate)

  // show the tooltip
  helpTooltip_Element.classList.remove('hidden')
}

map.on('pointermove', pointerMoveHandler)

// hide tooltip on exit from viewport
map.getViewport().addEventListener('mouseout', () => {
  helpTooltip_Element.classList.add('hidden')
})

const typeSelect = document.getElementById('type') as HTMLSelectElement

let drawInteraction: Draw

const fmtLen = (line: LineString): string => {
  const length = getLength(line)
  let output
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + ' ' + 'km';
  } else {
    output = Math.round(length * 100) / 100 + ' ' + 'm';
  }
  return output
}

const formatArea = (polygon: Polygon): string => {
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + ' ' + 'km<sup>2</sup>';
  } else {
    output = Math.round(area * 100) / 100 + ' ' + 'm<sup>2</sup>';
  }
  return output;
}

function addInteractions() {

  console.log(typeSelect.value)

  const type = typeSelect.value === 'Line' ? 'LineString' : 'Polygon'
  drawInteraction = new Draw({
    source,
    type,
    style: new Style({
      fill: new Fill({
        color: 'rgba(255, 255, 255, .2)'
      }),
      stroke: new Stroke({
        color: 'rgba(0, 0, 0, .5)',
        lineDash: [10, 10],
        width: 2
      }),
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({
          color: 'rgba(255, 255, 255, .2)'
        }),
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 0.7)',
        }),
      })
    })
  })

  map.addInteraction(drawInteraction)

  createMeasureTooltip()
  createHelpTooltip()

  let listener: EventsKey | undefined

  drawInteraction.on('drawstart', function (evt: DrawEvent) {
    currentSketch = evt.feature
    // const geom = currentSketch.getGeometry()
    let tooltipCoord: Coordinate
    
    // attach listener
    listener = currentSketch.getGeometry()?.on('change', function (evt) {
      const geom = evt.target
      let output: string = ""
      if (geom instanceof Polygon) {
        output = formatArea(geom)
        tooltipCoord = geom.getInteriorPoint().getCoordinates()
      } else if (geom instanceof LineString) {
        output = fmtLen(geom)
        tooltipCoord = geom.getLastCoordinate()
      }
      measureTooltip_Element!.innerHTML = output
      measureTooltip_Overlay.setPosition(tooltipCoord)
    })
  })

  drawInteraction.on('drawend', function() {
    measureTooltip_Element!.className = 'ol-tooltip ol-tooltip-static'
    measureTooltip_Overlay.setOffset([0, -7])
    currentSketch = null
    measureTooltip_Element = null
    createMeasureTooltip()
    unByKey(listener as EventsKey)
  })

}

function createMeasureTooltip() {
  if (measureTooltip_Element) {
    measureTooltip_Element.parentElement?.removeChild(measureTooltip_Element)
  }
  measureTooltip_Element = document.createElement('div')
  measureTooltip_Element.className = 'ol-tooltip ol-tooltip-measure'
  measureTooltip_Overlay = new Overlay({
    element: measureTooltip_Element,
    offset: [0, -15],
    positioning: 'bottom-center',
    stopEvent: false,
    insertFirst: false
  })
  map.addOverlay(measureTooltip_Overlay)
}

function createHelpTooltip() {
  if (helpTooltip_Element) {
    helpTooltip_Element.parentNode?.removeChild(helpTooltip_Element)
  }
  helpTooltip_Element = document.createElement('div')
  helpTooltip_Element.classList.add('ol-tooltip-hidden')
  helpTooltip_Overlay = new Overlay({
    element: helpTooltip_Element,
    offset: [15, 0],
    positioning: 'center-left'
  })
  map.addOverlay(helpTooltip_Overlay)
}

typeSelect.onchange = function () {
  console.log('changed')
  map.removeInteraction(drawInteraction)
  addInteractions()
}

addInteractions()
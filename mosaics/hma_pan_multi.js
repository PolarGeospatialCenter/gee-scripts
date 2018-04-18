/*
Google Earth Engine code to create panchromatic (pan) and multispectral (multi/rgb)
composites from Collection 1 Landsat 8 TOA reflectance imagery. 

TOA is used instead of SR, as SR does not contain the pan band. The Level 1 BQA band's
cloud and cloud shadow bits are used to filter unwanted pixels, which is mapped across
the entire Landsat 8 archive. 

The input boundary is HMA's extent by default (hma.kml). A custom extent can be used by 
either:

1) drawing a polygon on the map and import it as a geometry, or
2) loading a KML into Fusion Tables, and import as a FeatureCollection, see 
https://developers.google.com/earth-engine/importing#importing-tables-with-fusion-tables 
for details.

The images are added as map layers, and are staged to be downloaded to Google Drive. 
Ensure the Google Drive path, projection, etc. are set correctly. The output files
are staged in the "Tasks" tab; select "Run" to download to Google Drive.


Author:   Steve Foga
Created:  28 March 2018
*/


// load entire HMA boundary (source: hma.kml)
var hma_geom = ee.FeatureCollection('ft:1lrQgEi1xSlhn9wR51nUIcwQIqcfkjTP2ethP-Ufb');

// Load Landsat 8 TOA data
var l8toa = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA');

// Function to cloud mask from the Fmask band of Landsat 8 TOA data.
function maskL8toa(image) {
  // Bits 8 and 4 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = ee.Number(2).pow(8).int();
  var cloudsBitMask = ee.Number(2).pow(4).int();

  // Get the pixel QA band.
  var qa = image.select('BQA');

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));

  return image.updateMask(mask);
}

var toa_composite = l8toa.filterDate('2013-01-01', '2018-03-21')
                      .map(maskL8toa)
                      .median();

Map.addLayer(toa_composite, {bands: ['B4', 'B3', 'B2'], min: 0.05, max: 0.6}, 'toa composite');

// Convert the RGB bands to the HSV
var rgb = toa_composite.select('B4', 'B3', 'B2');
var pan = toa_composite.select('B8');

// Convert to HSV, swap in the pan band, and convert back to RGB.
var huesat = rgb.rgbToHsv().select('hue', 'saturation');
var upres = ee.Image.cat(huesat, pan).hsvToRgb();

// Apply color correction to RGB image
var imageRGB = upres.visualize({min: 0.05, max:0.6,
              gamma:[
                1.05, // red
                1.08, // green
                0.8]  // blue
});
//print(imageRGB)
Map.addLayer(imageRGB, {}, 'rgb')
Map.addLayer(pan, {}, 'pan')

// export final pan image to drive
Export.image.toDrive({
  image: pan,
  description: 'hma_l8_pan_3857_15m',
  scale: 15,
  folder: 'hma_pan',
  crs: 'EPSG:3857',
  region: hma_geom,
  maxPixels: 10000000000000
});

// export final rgb image to drive
Export.image.toDrive({
  image: imageRGB,
  description: 'hma_l8_rgb_3857_15m',
  scale: 15,
  folder: 'hma_multi',
  crs: 'EPSG:3857',
  region: hma_geom,
  maxPixels: 10000000000000
});

/*
Google Earth Engine code to create panchromatic (pan) and color (rgb)
composites from Collection 1 Landsat 8 TOA reflectance imagery. 
TOA is used instead of SR, as SR does not contain the pan band. The Level 1 BQA band's
cloud and cloud shadow bits are used to filter unwanted pixels, which is mapped across
the entire Landsat 8 archive. 
The input boundary is Alaska's extent by default (ak.kml). A custom extent can be used by 
either:

1) drawing a polygon on the map and import it as a geometry, or
2) loading a KML into Fusion Tables, and import as a FeatureCollection, see 
https://developers.google.com/earth-engine/importing#importing-tables-with-fusion-tables 
for details.

The images are added as map layers, and are staged to be downloaded to Google Drive. 
Ensure the Google Drive path, projection, etc. are set correctly. The output files
are staged in the "Tasks" tab; select "Run" to download to Google Drive.


Author:   Steve Foga
Created:  11 April 2018
*/


// load entire AK boundary (source: ak.kml)
var ak_geom = ee.FeatureCollection('ft:1pOCIx8Gs1cF4zh3tSTfONWzcoY9R32ZbH76Bssfu');

// Load Landsat 8 TOA data
var l8toa = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA');


// Function to mask cloud from the BQA band of Landsat 8 TOA data.
function maskL8toa(image) {
  var cirrusBitMask = ee.Number(2).pow(12).int(); // high and medium conf
  var cloudsBitMask = ee.Number(2).pow(4).int();

  /*
  Excluding snow/ice pixels helps get ice-free water, but produces poor results 
  over glaciers.
  
  Excluding shadow pixels in AK seems to produce too many artifacts. Using a red
  or NIR band threshold (say, reflectance < 10%) may help reduce artifacts.
  
  Masking water using "JRC Global Surface Water Mapping Layers v1.0 (1984-2015)"
  works well for larger water bodies, but is not fine enough to mask rivers.
  */

  // Get the BQA band.
  var qa = image.select('BQA');
  
  // Mask cloud and cirrus
  var mask = qa.bitwiseAnd(cloudsBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  
  return image.updateMask(mask);
}

// date ends based on above freezing temps in Barrow, AK
// source: https://www.usclimatedata.com/climate/barrow/alaska/united-states/usak0025
var l8_2013 = l8toa.filterDate('2013-05-20', '2013-09-15');
var l8_2014 = l8toa.filterDate('2014-05-20', '2014-09-18');
var l8_2015 = l8toa.filterDate('2015-05-20', '2015-09-07'); 
var l8_2016 = l8toa.filterDate('2016-05-20', '2016-09-08'); 
var l8_2017 = l8toa.filterDate('2017-05-20', '2017-09-10'); 
var l8_2018 = l8toa.filterDate('2018-05-20', '2018-09-15'); 
var l8_all = ee.ImageCollection(l8_2013.merge(l8_2014).merge(l8_2015).merge(l8_2016).merge(l8_2017).merge(l8_2018));

/*
var toa_composite = l8_all.filter(ee.Filter.gt('SUN_ELEVATION', 35))
                      .map(maskL8toa)
                      .mean();
*/

// median() statistics seems to produce less artifacts over AK than mean()
var toa_composite_median = l8_all.filter(ee.Filter.gt('SUN_ELEVATION', 35))
                      .map(maskL8toa)
                      .median();

var toa_8bit = toa_composite_median.select('B8').multiply(512).uint8();
Map.setCenter(-155, 64, 5);
Map.addLayer(toa_8bit, {min: 1, max: 250}, 'pan')


var rgb = toa_composite_median.select('B4', 'B3', 'B2');
var pan = toa_composite_median.select('B8');

// Convert to HSV, swap in the pan band, and convert back to RGB.
var huesat = rgb.rgbToHsv().select('hue', 'saturation');
var upres = ee.Image.cat(huesat, pan).hsvToRgb();

// Apply color correction to RGB image
var imageRGB = upres.visualize({min: 0.01, max:0.38,
              gamma:[
                1.05, // red
                1.08, // green
                0.8]  // blue
});

Map.addLayer(imageRGB, {}, 'rgb');

Export.image.toDrive({
  image: toa_8bit,
  description: 'ak_l8_pan_3857_15m',
  scale: 15,
  folder: 'ak_pan',
  crs: 'EPSG:3857',
  region: ak_geom,
  maxPixels: 10000000000000
});

// export final rgb image to drive
Export.image.toDrive({
  image: imageRGB,
  description: 'ak_l8_rgb_3857_15m',
  scale: 15,
  folder: 'ak_rgb',
  crs: 'EPSG:3857',
  region: ak_geom,
  maxPixels: 10000000000000
});

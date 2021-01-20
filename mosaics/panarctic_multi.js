// var geom = ee.FeatureCollection('users/sfoga/nogrl_tiles_dissolve_webmercator');
var geom = ee.FeatureCollection('users/sfoga/arctic_tiles_noice_dissolve');
var modis_water_mask = ee.Image("MODIS/MOD44W/MOD44W_005_2000_02_24");

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
var l8_2019 = l8toa.filterDate('2019-05-20', '2019-09-15');
var l8_2020 = l8toa.filterDate('2020-05-20', '2020-09-15');
var l8_all = ee.ImageCollection(l8_2013.merge(l8_2014).merge(l8_2015).merge(l8_2016).merge(l8_2017).merge(l8_2018).merge(l8_2019).merge(l8_2020))
    .select(['B2', 'B3', 'B4', 'B8', 'BQA']);

/*
var toa_composite = l8_all.filter(ee.Filter.gt('SUN_ELEVATION', 35))
                      .map(maskL8toa)
                      .mean();
*/

// median() statistics seems to produce less artifacts over AK than mean()
var _toa_composite_median = l8_all.filter(ee.Filter.gt('SUN_ELEVATION', 35))
                                  .filter(ee.Filter.or(
                                   ee.Filter.lt('WRS_ROW', 26),
                                   ee.Filter.gt('WRS_ROW', 218)))
                      .map(maskL8toa)
                      //.median();
                      .reduce(ee.Reducer.median(), 16);

// get water mask
var waterMask = modis_water_mask.select('water_mask');
var mask = waterMask.eq(0);

// buffer water mask so land/ice features aren't excluded
// 2,000 meters seems to work best with GEE's kernel limit
// ref 1: https://gis.stackexchange.com/a/318716
// ref 2: https://developers.google.com/earth-engine/apidocs/ee-image-focal_max#javascript
var mask_buffer = mask.focal_max(2000, 'circle', 'meters');

// make all non-land pixels 'water' so it can be assigned a uniform color when mosaicked
var mask_buffer_water = mask_buffer.not();

// apply mask to compsite
var toa_composite_median = _toa_composite_median.updateMask(mask_buffer)

//var toa_8bit = toa_composite_median.select('B8').multiply(512).uint8();
//var toa_8bit = toa_composite_median.select('B8_median').multiply(512).uint8();
Map.setCenter(-155, 64, 5);
//Map.addLayer(toa_8bit, {min: 1, max: 250}, 'pan')

// WITHOUT reducer
//var rgb = toa_composite_median.select('B4', 'B3', 'B2');
//var pan = toa_composite_median.select('B8');

// WITH reducer (renames bands automatically)
var rgb = toa_composite_median.select('B4_median', 'B3_median', 'B2_median');
var pan = toa_composite_median.select('B8_median');

// Convert to HSV, swap in the pan band, and convert back to RGB.
var huesat = rgb.rgbToHsv().select('hue', 'saturation');
var upres = ee.Image.cat(huesat, pan).hsvToRgb();

// 1) apply water buffer (mask_buffer_water) with constant color palette
// 2) apply color correction to RGB image
// min=0.01 and max=0.38 seems to show vegetation and geology well
var imageRGB = ee.ImageCollection([mask_buffer_water.visualize({palette: '000044'}),
upres.visualize({min: 0.01, max:0.38,
              gamma:[
                1.05, // red
                1.08, // green
                0.8]  // blue
}),
]).mosaic();

Map.addLayer(imageRGB, {}, 'rgb');
var imageRGB_red = imageRGB.select('vis-red');
var imageRGB_green = imageRGB.select('vis-green');
var imageRGB_blue = imageRGB.select('vis-blue');

/*Export.image.toDrive({
  image: toa_8bit,
  description: 'panarctic_l8_pan_3413_15m',
  scale: 15,
  folder: 'ak_pan',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});*/
//var geom =
// export final rgb image to drive
/*Export.image.toDrive({
  image: imageRGB,
  description: 'panarctic_l8_rgb_3413_15m',
  scale: 15,
  folder: 'panarctic_rgb_watermask',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});*/
Export.image.toDrive({
  image: imageRGB_red,
  description: 'panarctic_l8_red_3413_15m',
  scale: 15,
  folder: 'panarctic_rgb_watermask',
  crs: 'EPSG:3413',
  region: geom.geometry().bounds(),  // bounds() simplifies the output geometry
  maxPixels: 10000000000000
});

Export.image.toDrive({
  image: imageRGB_green,
  description: 'panarctic_l8_green_3413_15m',
  scale: 15,
  folder: 'panarctic_rgb_watermask',
  crs: 'EPSG:3413',
  region: geom.geometry().bounds(),
  maxPixels: 10000000000000
});

Export.image.toDrive({
  image: imageRGB_blue,
  description: 'panarctic_l8_blue_3413_15m',
  scale: 15,
  folder: 'panarctic_rgb_watermask',
  crs: 'EPSG:3413',
  region: geom.geometry().bounds(),
  maxPixels: 10000000000000
});
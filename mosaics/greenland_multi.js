var geom = ee.FeatureCollection('users/sfoga/grl_tiles_dissolve_webmercator');

// Load Landsat 8 TOA Tier 1 and Tier 2
// (interior Greenland does not exist in Tier 1 due to lack of GCPs)
var l8_t1 = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA');
var l8_t2 = ee.ImageCollection('LANDSAT/LC08/C01/T2_TOA');
var l8toa = l8_t1.merge(l8_t2);


// Function to mask cloud from the BQA band of Landsat 8 TOA data.
function maskL8toa(image) {
  var cirrusBitMask = ee.Number(2).pow(12).int(); // high and medium conf
  var cloudsBitMask = ee.Number(2).pow(4).int();

  // Get the BQA band.
  var qa = image.select('BQA');

  // Mask cloud and cirrus
  var mask = qa.bitwiseAnd(cloudsBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  //var mask = qa.bitwiseAnd(cloudsBitMask).eq(0)

  return image.updateMask(mask);
}


// median() statistics seems to produce less artifacts than mean()
// sun elevation > 20 ensures all of Greenland has valid imagery (even > 25 is too high)
var toa_composite_median = l8toa.filter(ee.Filter.gt('SUN_ELEVATION', 20))
                      .map(maskL8toa)
                      .median();

var toa_8bit = toa_composite_median.select('B8').multiply(512).uint8();
Map.setCenter(-26.0, 73.9, 8);
//Map.addLayer(toa_8bit, {min: 1, max: 250}, 'pan')


var rgb = toa_composite_median.select('B4', 'B3', 'B2');
var pan = toa_composite_median.select('B8');

// Convert to HSV, swap in the pan band, and convert back to RGB.
var huesat = rgb.rgbToHsv().select('hue', 'saturation');
var upres = ee.Image.cat(huesat, pan).hsvToRgb();

// Apply color correction to RGB image
// min=0.1 and max=0.85 seems to show both ice and geology well
var imageRGB = upres.visualize({min: 0.1, max:0.85,
              gamma:[
                1.05, // red
                1.08, // green
                0.8]  // blue
});

Map.addLayer(imageRGB, {}, 'rgb');

/*Export.image.toDrive({
  image: toa_8bit,
  description: 'panarctic_l8_pan_3413_15m',
  scale: 15,
  folder: 'ak_pan',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});*/

// export final rgb image to drive
Export.image.toDrive({
  image: imageRGB,
  description: 'grl_l8_rgb_3413_15m',
  scale: 15,
  folder: 'grl_rgb',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});

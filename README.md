# gee-scripts

## Introduction
Scripts used at the [Polar Geospatial Center](https://www.pgc.umn.edu/) to create mosaics and other products in [Google Earth Engine](https://code.earthengine.google.com/). 

## Mosaics
The [mosaics](mosaics/) scripts are used to generate seamless image composites of key study regions. They are created using Landsat 8 Top of Atmosphere (TOA) reflectance, composited using cloud-free pixels and statistical modifiers (e.g., mean) to create a composite. Input data typically span multiple years to maximize cloud-free data points for aggregation. Gamma levels are often modified to enhance image appearance. Therefore, images are meant for base mapping and visualization, and not designed for quantitative studies, navigation, or cadastral mapping. 

The composites will display in the Google Earth Engine code editor, and will prompt the user to download them to their Google Drive. The default output projection is Web Mercator - [EPSG:3857](https://epsg.io/3857).

## Geometries
The [geoms](geoms/) used to determine image output extent are also provided. Note the boundaries are not always rectangular; Google Earth Engine uses a minimum bounding rectangle from the supplied geometry. The KML files are first ingested to Google Fusion Tables, and are imported into the script. Google provides a description of how to upload custom geometry [here](https://developers.google.com/earth-engine/importing#importing-tables-with-fusion-tables). Note that the preferred file format is KML, the file must contain only **one** geometry, and the geometry must be projected in Web Mercator.

The [Alaska geometry](geoms/ak.kml) is simplified to a single geometry, and is truncated at the 180th parallel, as Google Earth Engine does not accept multipolygon geometry. 

Like the mosaics, the geometries are provided as a reference, and are not designed to represent cadastral boundaries. 

## Contact
Steve Foga
Polar Geospatial Center
sfoga@umn.edu
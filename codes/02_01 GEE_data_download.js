/************************************
* 1.  Import the AOI (Jaipur city)
************************************/
var aoi =
  ee.FeatureCollection('projects/ee-miaoyilee/assets/jaipur_boundary')
    .geometry();

Map.centerObject(aoi, 10);

Map.addLayer(aoi,
  {color: 'red'},
  'Jaipur Boundary');

//*******************************************
/* 2.  2024 mean NDVI from Landsat-9 SR data
*******************************************/
// Landsat-9 Collection-2, Level-2 (surface reflectance, already atmos-corrected)
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
            .filterBounds(aoi)
            .filterDate('2024-01-01', '2024-12-31');

// Cloud-masking and NDVI function
function prepNdvi(img) {
  // QA_PIXEL bit flags: 3 = cloud shadow, 5 = clouds, 9 = cirrus
  var qa = img.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0)
               .and(qa.bitwiseAnd(1 << 5).eq(0))
               .and(qa.bitwiseAnd(1 << 9).eq(0));
  img = img.updateMask(mask);

  // Convert DN to reflectance (scale factor 0.0000275, offset -0.2)
  var refl = img.select(['SR_B4', 'SR_B5'])   // red, NIR
                .multiply(0.0000275)
                .add(-0.2)
                .rename(['red', 'nir']);

  // NDVI = (NIR-Red)/(NIR+Red)
  var ndvi = refl.normalizedDifference(['nir', 'red'])
                 .rename('NDVI');

  return ndvi.copyProperties(img, img.propertyNames());
}

// Build NDVI collection and take the annual mean
var ndviCol  = l9.map(prepNdvi);
var ndvi2024 = ndviCol.mean()
                      .clip(aoi)
                      .set({year: 2024,
                            description: 'Jaipur_mean_NDVI_2024'});

// Visual check
Map.centerObject(aoi, 10);
Map.addLayer(ndvi2024,
             {min: 0, max: 0.8, palette: ['#d73027', '#fdae61', '#1a9850']},
             'NDVI 2024');

/******************************************************
* 3.  GHSL Built-up Surface for 2020 (m² per pixel)
******************************************************/
var ghsl2020 = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_S/2020')
                  .select('built_surface')
                  .clip(aoi)
                  .set({year: 2020,
                        description: 'Jaipur_GHSL_built_surface_2020'});

Map.addLayer(ghsl2020,
             {min: 0, max: 8000, palette: ['#000000', '#FFFFFF']},
             'GHSL built surface 2020');


/**************************************************
* 4.  VIIRS Night-time Lights (annual, 2023-2024)
**************************************************/
var viirs = ee.ImageCollection('NOAA/VIIRS/DNB/ANNUAL_V22')
              .filterDate('2023-01-01', '2024-01-01')   // covers one year
              .select('average')
              .first()
              .clip(aoi)
              .set({year: '2023-2024',
                    description: 'Jaipur_VIIRS_DNB_average_2023_2024'});

Map.addLayer(viirs,
             {min: 0, max: 50, palette: ['#000000', '#FFFF00']},
             'VIIRS DNB 2023/24');

/************************************
* 5.  Export all layers to Drive
************************************/
Export.image.toDrive({
  image: ndvi2024,
  description: 'Jaipur_NDVI_mean_2024',
  folder: 'dissertation',
  fileNamePrefix: 'Jaipur_NDVI_mean_2024',
  region: aoi,
  scale: 100, //resample to 100 as pop
  crs: 'EPSG:32643',
  maxPixels: 1e13
});

Export.image.toDrive({
  image: ghsl2020,
  description: 'Jaipur_GHSL_built_surface_2020',
  folder: 'dissertation',
  fileNamePrefix: 'Jaipur_GHSL_built_surface_2020',
  region: aoi,
  crs: 'EPSG:32643',
  scale: 100,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: viirs,
  description: 'Jaipur_VIIRS_DNB_average_2023_2024',
  folder: 'dissertation',
  fileNamePrefix: 'Jaipur_VIIRS_DNB_average_2023_2024',
  region: aoi,
  crs: 'EPSG:32643',
  scale: 100,
  maxPixels: 1e13
});
// Import required packages
var palettes = require('users/gena/packages:palettes');
var style = require('users/gena/packages:style');

// Load datasets
var jaipurBoundary = ee.FeatureCollection('projects/ee-miaoyilee/assets/jaipur_boundary');
var popCount = ee.Image('projects/jaipur-urban-act/assets/Jaipur_gwr_population_and_id_100m_new');
var epiFeatureCollection = ee.FeatureCollection('projects/jaipur-urban-act/assets/jaipur_EPI_re');
var wardBoundaries = ee.FeatureCollection('projects/jaipur-urban-act/assets/jaipur_ward');

// Initialize UI
ui.root.clear();

// Create main panel and map
var mainPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '400px', padding: '10px'}
});

var map = ui.Map();
map.setCenter(75.7873, 26.9124, 12);
map.setOptions('SATELLITE');

// Create app title
mainPanel.add(ui.Label('Jaipur Urban Activities Analysis App', {
  fontWeight: 'bold',
  fontSize: '22px',
  margin: '0 0 10px 0',
  color: '#E03625',
}));

// Add general instructions
mainPanel.add(ui.Label(
    'Welcome!\n\n' +
  'This app helps analyze urban development patterns and population distribution in Jaipur city.\n\n' +
  'The Population Aggregation Function allows you to draw polygons and compare population statistics between different areas. The Economic Activity Index(EAI) exploration feature lets you examine the current economic activity levels across different wards of Jaipur.\n\n' +
  'Select a function from the buttons below to begin your analysis. Draw polygons on the map to calculate population statistics or explore the EAI distribution across the city.',
  {whiteSpace: 'pre-line', margin: '0 0 15px 0'}
));

// Create function buttons
var popAggregationButton = ui.Button({
  label: 'Population Aggregation Function',
  onClick: function() {
    showPanel(popAggregationPanel);
  },
  style: {margin: '0 10px 5px 0',color: '#E03625'},

});

var epiExploreButton = ui.Button({
  label: 'Explore Economic Activity Index',
  onClick: function() {
    showPanel(epiExplorePanel);
  },
  style: {margin: '0 0 5px 0',color: '#E03625'}
});

// Add buttons to main panel
var buttonPanel = ui.Panel([popAggregationButton, epiExploreButton],
  ui.Panel.Layout.flow('horizontal'), {margin: '0 0 10px 0'});
mainPanel.add(buttonPanel);

// Create content container
var contentContainer = ui.Panel({style: {margin: '10px 0'}});
mainPanel.add(contentContainer);

// Global variables for polygon tracking and result panels
var polygonCount = 0;
var maxPolygons = 2; // Maximum 2 polygons allowed
var polygonLayers = [];
var resultPanels = [];

// Create dynamic legend
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});
map.add(legend);

// Create population aggregation panel
var popAggregationPanel = ui.Panel({
  style: {border: '1px solid #999', padding: '8px'}
});

popAggregationPanel.add(ui.Label('Draw up to two polygons on the map to compare population statistics',
  {fontSize: '14px', margin: '0 0 10px 0'}));

// Add draw polygon button
var drawButton = ui.Button({
  label: '📐  Draw Polygon',
  onClick: function() {
    if (polygonCount >= maxPolygons) {
      alert('You can only draw up to ' + maxPolygons + ' polygons. Please reset to draw new polygons.');
      return;
    }

    // Clear previous drawing layers but keep existing polygons
    map.drawingTools().setShape('polygon');
    map.drawingTools().draw();

    // Hide drawing tools until drawing is complete
    map.drawingTools().setShown(false);
  },
  style: {margin: '0 15px 5px 0',color: '#E03625'}
});

// Add reset button
var resetButton = ui.Button({
  label: 'Reset Polygons',
  onClick: function() {
    // Clear all polygons
    clearDrawings();

    // Clear result panels
    clearResultPanels();

    // Reset polygon count
    polygonCount = 0;
    drawButton.setDisabled(false);

    // Restore population layer
    resetMapLayers(true);
  },
 style: {margin: '0 0 10px 0', color:'#E03625'}
});

// Add buttons to panel
var buttonPanel = ui.Panel([drawButton, resetButton],
  ui.Panel.Layout.flow('horizontal'), {margin: '0 0 10px 0'});
popAggregationPanel.add(buttonPanel);

// Set up map drawing completion event
map.drawingTools().onDraw(function(geometry) {
  if (polygonCount >= maxPolygons) {
    return;
  }

  // Assign color to new polygon (first red, second blue)
  var colors = ['#D73A55', 'blue'];
  var color = colors[polygonCount];

  // Highlight drawn polygon
  var highlightedPolygon = ui.Map.Layer(geometry, {color: color, fillColor: color + '33'}, 'Polygon ' + (polygonCount + 1));
  map.layers().add(highlightedPolygon);
  polygonLayers.push(highlightedPolygon);

  // Calculate population sum within polygon
  var populationSum = popCount.select('b1').reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 100,
    maxPixels: 1e13
  });

  // Create new result panel
  var resultPanel = ui.Panel({
    style: {
      margin: '10px 0',
      padding: '5px',
      border: '1px solid ' + color,
      backgroundColor: 'rgba(255, 255, 255, 0.8)'
    }
  });

  resultPanel.add(ui.Label('Polygon ' + (polygonCount + 1) + ' Results:', {fontWeight: 'bold', color: color}));

  // Display results
  populationSum.get('b1').evaluate(function(sum) {
    resultPanel.add(ui.Label('Total Population: ' + sum.toFixed(0)));

    // Create histogram
    var histogram = ui.Chart.image.histogram({
      image: popCount.select('b1').clip(geometry),
      region: geometry,
      scale: 100,
      maxPixels: 1e13
    });

    histogram.setOptions({
      title: 'Population Distribution - Polygon ' + (polygonCount + 1),
      hAxis: {title: 'Population Count'},
      vAxis: {title: 'Frequency'},
      legend: {position: 'none'},
      colors: [color]
    });

    resultPanel.add(histogram);

    // Add result panel to aggregation panel
    popAggregationPanel.add(resultPanel);
    resultPanels.push(resultPanel);

    // Increment polygon count
    polygonCount++;

    // Disable draw button if max polygons reached
    if (polygonCount >= maxPolygons) {
      drawButton.setDisabled(true);
    }
  });

  // Stop drawing tools
  map.drawingTools().stop();
});

// Create EAI exploration panel
var epiExplorePanel = ui.Panel({
  style: {border: '1px solid #999', padding: '8px'}
});

epiExplorePanel.add(ui.Label('Explore Economic Activity Index across Jaipur Wards',
  {fontSize: '14px', margin: '0 0 10px 0'}));

// Set EAI visualization parameters - using matplotlib.plasma palette
var epiVis = {
  min: -0.5,
  max: 1.7, // Adjust based on actual EAI value range
  palette: palettes.matplotlib.plasma[7]  // Using matplotlib.plasma palette
};

// Create chart container panel
var chartContainer = ui.Panel({
  style: {margin: '10px 0'}
});
epiExplorePanel.add(chartContainer);

// Add ward aggregation button
var aggregateToWardsButton = ui.Button({
  label: 'Aggregate EAI to Wards',
  onClick: function() {
    // Clear previous charts
    chartContainer.clear();

    // Convert EAI feature collection to image
    var epiImage = epiFeatureCollection.reduceToImage({
      properties: ['EPI_o'],
      reducer: ee.Reducer.mean()
    });

    // Calculate average EAI for each ward
    var wardEpi = wardBoundaries.map(function(ward) {
      var meanEpi = epiImage.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: ward.geometry(),
        scale: 100,
        maxPixels: 1e13
      }).get('mean');

      return ward.set('mean_EPI', meanEpi);
    });


    // Sort and get top 10 wards
    var top10Wards = wardEpi.sort('mean_EPI', false).limit(10);

    // Reset map layers with proper order
    resetMapLayers(false);

    // Highlight top 10 wards on map - ensure it's above EAI layer
    var top10WardsLayer = ui.Map.Layer(
      top10Wards.style({color: '#E03625', fillColor: '00000000', width: 2}),
      {},
      'Top 10 Wards'
    );

    // Add highlight layer to top of map
    map.layers().add(top10WardsLayer);

    // Create bar chart with error handling
    top10Wards.evaluate(function(wards) {
      if (wards && wards.features && wards.features.length > 0) {
        var chart = ui.Chart.feature.byFeature(top10Wards, 'ward_id', 'mean_EPI')
          .setChartType('ColumnChart')
          .setOptions({
            title: 'Top 10 Wards by EAI',
            hAxis: {title: 'Ward ID'},
            vAxis: {title: 'Average EAI'},
            legend: {position: 'none'},
            colors: ['#D73A55']
          });

        // Display chart
        chartContainer.add(chart);
      } else {
        // Show error message if no data
        chartContainer.add(ui.Label('No ward data available for chart generation.',
          {color: 'red', fontStyle: 'italic'}));
      }
    });

    // Add note label
    var noteLabel = ui.Label('H means Jaipur Heritage Area', {
      margin: '3px 0 10px 0',
      fontSize: '12px',
      fontStyle: 'italic',
      color: '#666666'  // Gray text for note distinction
    });

    // Add note to chart container
    chartContainer.add(noteLabel);
  },
    style: {
    color: '#E03625',  // Button text color
    margin: '5px 0'    // Maintain original spacing
  }
});
epiExplorePanel.add(aggregateToWardsButton);

// Create variable selection area
var variableSelectPanel = ui.Panel({
  style: {margin: '15px 0', padding: '8px', border: '1px solid #ddd'}
});

// Variable mapping - original field names to display names
var variableMap = {
  'transport_': 'Transport Station (Point)',
  'transpor_1': 'Transport Station (Polygon)',
  'motorable_': 'Motorable Network',
  'amenities_': 'Amenities POI',
  'office_poi': 'Office POI',
  'shop_poi': 'Shop POI',
  'ndvi_mean': 'NDVI',
  'ntl_mean': 'Nighttime Light Intensity',
  'pop_densit': 'Population Density',
  'builtup_de': 'Built-up Density'
};

// Variable standardization min and max values (adjust based on actual data)
var variableMinMax = {
  'transport_': {min: 0, max: 15, palette: palettes.colorbrewer.RdPu[9]},
  'transpor_1': {min: 0, max: 3, palette: palettes.colorbrewer.RdPu[9]},
  'motorable_': {min: 0, max: 60000, palette: palettes.colorbrewer.RdPu[9]},
  'amenities_': {min: 0, max: 20, palette: palettes.colorbrewer.RdPu[9]},
  'office_poi': {min: 0, max: 15, palette: palettes.colorbrewer.RdPu[9]},
  'shop_poi': {min: 0, max: 25, palette: palettes.colorbrewer.RdPu[9]},
  'ndvi_mean': {min: 0, max: 0.65, palette: palettes.colorbrewer.RdPu[9]},
  'ntl_mean': {min: 0, max: 60, palette: palettes.colorbrewer.RdPu[9]},
  'pop_densit': {min: 0, max: 30000, palette: palettes.colorbrewer.RdPu[9]},
  'builtup_de': {min: 0, max: 1, palette: palettes.colorbrewer.RdPu[9]}
};

// Create variable selection dropdown
variableSelectPanel.add(ui.Label('Select Variable Contributing to EAI to Visualize:', {fontWeight: 'bold'}));

var variableSelect = ui.Select({
  items: Object.keys(variableMap).map(function(key) {
    return {
      label: variableMap[key],
      value: key
    };
  }),
  placeholder: 'Select a variable...',
  onChange: function(selected) {
    if (selected) {
      // Convert selected variable to image
      var variableImage = epiFeatureCollection.reduceToImage({
        properties: [selected],
        reducer: ee.Reducer.mean()
      });

      // Get visualization parameters for variable
      var visParams = variableMinMax[selected] || {min: 0, max: 100, palette: palettes.colorbrewer.YlOrBr[9]};

      // Reset map layers without showing EAI
      resetMapLayers(false, false);

      // Add variable layer
      var variableLayer = ui.Map.Layer(
        variableImage,
        visParams,
        variableMap[selected] + ' Map'
      );
      map.layers().add(variableLayer);

      // Update legend for selected variable
      updateLegendToVariable(selected);
    }
  },
  style: {margin: '5px 0', color: '#E03625',}
});

variableSelectPanel.add(variableSelect);

// Add return to EAI map button
var returnToEAIButton = ui.Button({
  label: 'Return to EAI Map',
  onClick: function() {
    // Reset to EAI map
    resetMapLayers(false);
  },
  style: {margin: '5px 0',color: '#E03625'}
});

variableSelectPanel.add(returnToEAIButton);

// Add variable selection panel to EAI exploration panel
epiExplorePanel.add(variableSelectPanel);

// Update legend for variable
function updateLegendToVariable(variableName) {
  legend.clear();

  // Get variable display name
  var displayName = variableMap[variableName] || variableName;

  var legendTitle = ui.Label({
    value: displayName,
    style: {
      fontWeight: 'bold',
      fontSize: '14px',
      margin: '0 0 4px 0',
      padding: '0'
    }
  });

  legend.add(legendTitle);

  // Get visualization parameters for variable
  var visParams = variableMinMax[variableName] || {min: 0, max: 100, palette: palettes.colorbrewer.YlOrBr[9]};

  // Create color bar
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0)
      .multiply((visParams.max - visParams.min) / 100.0).add(visParams.min)
      .visualize({min: visParams.min, max: visParams.max, palette: visParams.palette}),
    params: {bbox: [0, 0, 100, 10], dimensions: '100x10'},
    style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'}
  });

  legend.add(colorBar);

  // Add labels
  var legendLabels = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '1px 0 0 0'}
  });

  legendLabels.add(ui.Label(visParams.min.toString(), {fontSize: '12px'}));
  legendLabels.add(ui.Label(' ', {stretch: 'horizontal'})); // Spacer
  legendLabels.add(ui.Label(visParams.max.toString(), {fontSize: '12px'}));

  legend.add(legendLabels);
}

// Update legend for population count - using colorbrewer.PuRd palette
function updateLegendToPopulation() {
  legend.clear();

  var legendTitle = ui.Label({
    value: 'Population Count',
    style: {
      fontWeight: 'bold',
      fontSize: '14px',
      margin: '0 0 4px 0',
      padding: '0'
    }
  });

  legend.add(legendTitle);

  // Define color gradient and range - using colorbrewer.PuRd palette
  var popPalette = palettes.colorbrewer.PuRd[9];  // Using 9-level palette
  var popMin = 7;
  var popMax = 120; // Adjust based on actual data

  // Create color bar
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0).multiply((popMax - popMin) / 100.0).add(popMin)
      .visualize({min: popMin, max: popMax, palette: popPalette}),
    params: {bbox: [0, 0, 100, 10], dimensions: '100x10'},
    style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'}
  });

  legend.add(colorBar);

  // Add labels
  var legendLabels = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '1px 0 0 0'}
  });

  legendLabels.add(ui.Label(popMin.toString(), {fontSize: '12px'}));
  legendLabels.add(ui.Label(' ', {stretch: 'horizontal'})); // Spacer
  legendLabels.add(ui.Label(popMax.toString(), {fontSize: '12px'}));

  legend.add(legendLabels);
}

// Update legend for EAI - using matplotlib.plasma palette
function updateLegendToEPI() {
  legend.clear();

  var legendTitle = ui.Label({
    value: 'Economic Activity Index',
    style: {
      fontWeight: 'bold',
      fontSize: '14px',
      margin: '0 0 4px 0',
      padding: '0'
    }
  });

  legend.add(legendTitle);

  // Define color gradient and range - using matplotlib.plasma palette
  var epiPalette = palettes.matplotlib.plasma[7];  // Using 7-level palette
  var epiMin = -0.5;
  var epiMax = 1.7; // Adjust based on actual data

  // Create color bar
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0).multiply((epiMax - epiMin) / 100.0).add(epiMin)
      .visualize({min: epiMin, max: epiMax, palette: epiPalette}),
    params: {bbox: [0, 0, 100, 10], dimensions: '100x10'},
    style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'}
  });

  legend.add(colorBar);

  // Add labels
  var legendLabels = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '1px 0 0 0'}
  });

  legendLabels.add(ui.Label(epiMin.toString(), {fontSize: '12px'}));
  legendLabels.add(ui.Label(' ', {stretch: 'horizontal'})); // Spacer
  legendLabels.add(ui.Label(epiMax.toString(), {fontSize: '12px'}));

  legend.add(legendLabels);
}

// Helper function: display alert message
function alert(message) {
  try {
    var alertPanel = ui.Panel({
      widgets: [ui.Label(message, {color: 'red', fontWeight: 'bold'})],
      style: {
        position: 'top-center',
        padding: '10px',
        backgroundColor: 'white',
        border: '2px solid red'
      }
    });
    map.add(alertPanel);

    // Auto-remove alert after 3 seconds
    setTimeout(function() {
      map.remove(alertPanel);
    }, 3000);
  } catch (e) {
    console.log('Alert message:', message);
  }
}

// Clear drawings and layers
function clearDrawings() {
  // Clear all layers in drawing tools
  map.drawingTools().layers().reset();
  polygonLayers = [];
}

// Clear result panels
function clearResultPanels() {
  // Use safer method to clear result panels
  for (var i = resultPanels.length - 1; i >= 0; i--) {
    try {
      popAggregationPanel.remove(resultPanels[i]);
    } catch (e) {
      // Ignore errors, continue clearing
      console.log('Error removing panel:', e);
    }
  }
  resultPanels = [];
}

// Reset map layers, keeping Jaipur boundary
function resetMapLayers(isPopPanel, showEAI) {
  // showEAI parameter defaults to true, controls whether to show EAI layer
  showEAI = (showEAI !== undefined) ? showEAI : true;

  // Clear all layers
  map.layers().reset();

  // Add Jaipur boundary as base layer (always visible)
  var boundaryLayer = ui.Map.Layer(
    jaipurBoundary.style({
      color: 'hotpink',
      fillColor: 'FFFFFF1A',
      width: 2
    }),
    {},
    'Jaipur Boundary'
  );
  map.layers().add(boundaryLayer);

  // Add corresponding layers based on current panel and update legend
  if (isPopPanel) {
    // Population panel: add population layer - using colorbrewer.PuRd palette
    var popLayer = ui.Map.Layer(
      popCount.select('b1'),
      {min: 7, max: 120, palette: palettes.colorbrewer.PuRd[9]},  // Using colorbrewer.PuRd palette
      'Population Count'
    );
    map.layers().add(popLayer);

    // Update legend for population count
    updateLegendToPopulation();

    // Re-add existing polygon layers
    for (var i = 0; i < polygonLayers.length; i++) {
      map.layers().add(polygonLayers[i]);
    }
  } else if (showEAI) {
    // EAI panel: add EAI layer
    var epiImage = epiFeatureCollection.reduceToImage({
      properties: ['EPI_o'],
      reducer: ee.Reducer.mean()
    });

    var epiLayer = ui.Map.Layer(
      epiImage,
      epiVis,
      'EAI Map'
    );
    map.layers().add(epiLayer);

    // Update legend for EAI
    updateLegendToEPI();
  }
}

// Function: switch display panel
function showPanel(panel) {
  contentContainer.clear();
  contentContainer.add(panel);

  if (panel === popAggregationPanel) {
    // Switch to population panel
    clearDrawings();
    clearResultPanels();
    polygonCount = 0;
    drawButton.setDisabled(false);

    // Show population data panel
    resetMapLayers(true);

    // Clear variable selection dropdown
    variableSelect.setValue(null);
  } else if (panel === epiExplorePanel) {
    // Switch to EAI panel
    clearDrawings();
    clearResultPanels();
    polygonCount = 0;
    drawButton.setDisabled(false);

    // Show EAI data panel
    resetMapLayers(false);

    // Clear charts
    chartContainer.clear();

    // Clear variable selection dropdown
    variableSelect.setValue(null);
  }
}

// Initialize map and UI
resetMapLayers(true);
showPanel(popAggregationPanel);

// Add to UI root
ui.root.add(ui.Panel([mainPanel, map], ui.Panel.Layout.flow('horizontal'),
  {width: '100%', height: '100%'}));
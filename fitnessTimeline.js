function fitnessTimeline() {
  var entryHeight = 15;

  var netWidth = 40;
  var barWidth = 400;
  var dateWidth = 40;
  var graphWidth = 190;
  var columnMargin = 10;

  var showNet = true;
  var showBar = true;
  var showDate = true;
  var showGraph = true;

  var dateParseFormat = "%Y-%m-%d";
  var dateDisplayFormat = "%d %b";
  var numberDisplayFormat = ",d";

  // For shifting text from its baseline to its middle
  var textMiddle = ".35em";

  function chart(selection) {
    var parseDate = d3.time.format(dateParseFormat).parse;
    var formatDate = d3.time.format(dateDisplayFormat);
    var formatNumber = d3.format(numberDisplayFormat);

    selection.each(function(data) {
      var lastWeight = null;

      // Munge the input data
      // TODO: This seems clunky
      data = data.map(function(d, i) {
        var datum = {
          type: d.type,
          date: d.date ? parseDate(d.date) : null
        };

        if (d.type === "diary") {
          datum.goal = d.goal;
          datum.food = d.food;
          datum.exercise = d.exercise;
        }

        if (d.type === "weight") {
          datum.goal = d.goal;
          datum.value = d.value;

          // Differences for the "net" column
          datum.lastWeight = lastWeight;
          lastWeight = datum.value;

          // Indices for the "graph" column
          datum.index = i;
        }

        return datum;
      });

      // Calculate translation offsets of enabled columns... eww
      var barX = showNet ? netWidth + columnMargin : 0;
      var dateX = showBar ? barX + barWidth + columnMargin : barX;
      var graphX = showDate ? dateX + dateWidth + columnMargin : dateX;
      var width = showGraph ? graphX + graphWidth : graphX;

      var weightData = data.filter(function(d) { return d.type === "weight"; });
      var diaryData = data.filter(function(d) { return d.type == "diary"; });

      // We want the goal weight to always be visible!
      var minWeight = d3.min(weightData, function(d) { return Math.min(d.goal, d.value); });
      var maxWeight = d3.max(weightData, function(d) { return Math.max(d.goal, d.value); });

      // Ignore exercise here; it only subtracts from the net
      var maxCalories = d3.max(diaryData, function(d) { return d.food; });

      var calorieScale = d3.scale.linear()
        .domain([0, maxCalories])
        .range([0, barWidth]);

      var weightScale = d3.scale.linear()
        .domain([minWeight, maxWeight])
        .range([0, graphWidth]);

      // TODO: don't select the SVG; create or re-use a child SVG
      // see http://bost.ocks.org/mike/chart/time-series-chart.js
      // and http://bost.ocks.org/mike/chart/
      // and http://stackoverflow.com/questions/14665786/some-clarification-on-reusable-charts
      var svg = d3.select(this)
        .attr("width", width)
        .attr("height", entryHeight * data.length);

      var entry = svg.selectAll("g.entry")
        .data(data)
        .enter().append("g")
          .attr("transform", function(d, i) { return "translate(0," + i * entryHeight + ")"; });

      entry.each(function(d) {
        var gEntry = d3.select(this)
          .attr("class", d.type + " entry");

        // Net/bar/date columns
        // Appearance and content varies depending on the type of entry

        // But they all have a bar or line of some kind
        var bar = gEntry.append("g")
          .attr("transform", "translate(" + barX + ", 0)")
          .attr("class", "bar");

        if (d.type === "diary") {

          var netCalories = (d.food - d.exercise) - d.goal;
          var yay = netCalories <= 0;

          gEntry.classed({"deficit": yay, "surplus": !yay});

          if (showNet) {
            gEntry.append("text")
              .attr("class", "net")
              .attr("x", netWidth)
              .attr("y", entryHeight / 2)
              .attr("dy", textMiddle)
              .text(formatNumber(netCalories));
          }

          if (showBar) {
            bar.append("rect")
              .attr("class", "food")
              .attr("height", entryHeight - 1)
              .attr("width", function(d) { return calorieScale(d.food); });

            bar.append("rect")
              .attr("class", "exercise")
              .attr("width", function(d) { return calorieScale(d.exercise); })
              .attr("height", entryHeight - 1)
              .attr("transform", function(d) { return "translate(" + calorieScale(d.food - d.exercise)  + ",0)"; });

            // Pixel perfect alignment of goal lines
            // Assumes stroke-width is odd, meh
            var goalPx = Math.floor(calorieScale(d.goal)) + 0.5;

            bar.append("line")
              .attr("class", "goal")
              .attr("x1", goalPx)
              .attr("y1", 0)
              .attr("x2", goalPx)
              .attr("y2", entryHeight - 1);
          }

        } else if (d.type === "weight") {

          if (showNet && d.lastWeight) {
            gEntry.append("text")
              .attr("x", netWidth)
              .attr("y", entryHeight / 2)
              .attr("dy", textMiddle)
              .text(function(d) { return d.value - d.lastWeight; });
          }

          if (showBar) {
            bar.append("line")
              .attr("x1", 0)
              .attr("y1", entryHeight / 2)
              .attr("x2", barWidth)
              .attr("y2", entryHeight / 2);
          }

          if (showDate) {
            gEntry.append("text")
              .attr("x", dateX + dateWidth)
              .attr("y", entryHeight / 2)
              .attr("dy", textMiddle)
              .text(function(d) { return formatNumber(d.value); });
          }

        } else if (d.type === "lacuna") {

          if (showNet) {
            gEntry.append("text")
              .attr("x", netWidth)
              .attr("y", entryHeight / 2)
              .attr("dy", textMiddle)
              .text("no data");
          }

          if (showBar) {
            bar.append("line")
              .attr("x1", 0)
              .attr("y1", entryHeight / 2)
              .attr("x2", barWidth)
              .attr("y2", entryHeight / 2);
          }
        }

        if (showDate && d.date) {
          gEntry.append("text")
            .attr("class", "date")
            .attr("x", dateX + dateWidth)
            .attr("y", entryHeight / 2)
            .attr("dy", textMiddle)
            .text(function(d) { return formatDate(d.date); });
        }
      });

      // Finally, the graph column

      if (!showGraph) {
        // Or not
        return;
      }

      // TODO: Show goal line on weight graph (thin line, square interp)

      var weightLine = d3.svg.line()
        .interpolate("basis")
        .x(function(d) { return weightScale(d.value); })
        .y(function(d) { return d.index * entryHeight + (entryHeight / 2); });

      var weightArea = d3.svg.area()
        .interpolate("basis")
        .x(weightLine.x())
        .y(weightLine.y())
        .x0(weightScale(minWeight));

      var weightGraph = svg.append("g")
        .datum(weightData)
        .attr("class", "weight graph")
        .attr("transform", "translate(" + graphX + ", 0)");

      weightGraph.append("path")
        .attr("class", "area")
        .attr("d", weightArea);

      weightGraph.append("path")
        .attr("class", "line")
        .attr("d", weightLine);
    });
  }

  // Accessors ahoy

  chart.entryHeight = function(_) {
    if (!arguments.length) return entryHeight;
    entryHeight = _;
    return chart;
  }

  chart.netWidth = function(_) {
    if (!arguments.length) return netWidth;
    netWidth = _;
    return chart;
  }

  chart.barWidth = function(_) {
    if (!arguments.length) return barWidth;
    barWidth = _;
    return chart;
  }

  chart.dateWidth = function(_) {
    if (!arguments.length) return dateWidth;
    dateWidth = _;
    return chart;
  }

  chart.graphWidth = function(_) {
    if (!arguments.length) return graphWidth;
    graphWidth = _;
    return chart;
  }

  chart.columnMargin = function(_) {
    if (!arguments.length) return columnMargin;
    columnMargin = _;
    return chart;
  }

  chart.showNet = function(_) {
    if (!arguments.length) return showNet;
    showNet = _;
    return chart;
  }

  chart.showBar = function(_) {
    if (!arguments.length) return showBar;
    showBar = _;
    return chart;
  }

  chart.showDate = function(_) {
    if (!arguments.length) return showDate;
    showDate = _;
    return chart;
  }

  chart.showGraph = function(_) {
    if (!arguments.length) return showGraph;
    showGraph = _;
    return chart;
  }

  chart.dateParseFormat = function(_) {
    if (!arguments.length) return dateParseFormat;
    dateParseFormat = _;
    return chart;
  }

  chart.dateDisplayFormat = function(_) {
    if (!arguments.length) return dateDisplayFormat;
    dateDisplayFormat = _;
    return chart;
  }

  chart.numberDisplayFormat = function(_) {
    if (!arguments.length) return numberDisplayFormat;
    numberDisplayFormat = _;
    return chart;
  }

  return chart;
}

// vim: ts=2:sw=2

import {
  axisBottom,
  axisLeft,
  max as d3Max,
  range as d3Range,
  format as d3Format,
  scaleOrdinal,
  scaleBand,
  scaleLinear,
  schemePaired
} from 'd3';

export function barChart() {
  let width;
  let height;
  let margin = { top: 10, right: 10, bottom: 10, left: 10 };
  let colour = scaleOrdinal(schemePaired); // colour scheme

  function chart(selection) {
    selection.each(function (data) {
      // initialize chart components
      let x = scaleBand().range([0, width]).padding(0.1);
      let y = scaleLinear().range([height, 0]);

      let y_max = d3Max(data, (d) => d.value);
      x.domain(d3Range(0, 101));
      y.domain([0, y_max]);

      let xticks = x.domain().filter((d, i) => !(i % 10));
      let xAxis = axisBottom(x).tickValues(xticks);

      let yticks = d3Range(0, y_max + 1);
      let spacing = Math.ceil(yticks.length / 5);
      yticks = yticks.filter((f) => f / spacing === Math.round(f / spacing));
      let yAxis = axisLeft(y).tickValues(yticks).tickFormat(d3Format('.0r'));

      // ===========================================================================================
      // append the svg object to the selection
      let svg = selection
        .append('svg')
        .attr('class', 'drop-shadow')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      // ===========================================================================================

      // generate chart
      data.forEach(function (d) {
        d.pct = +d.pct;
        d.value = +d.value;
      });

      svg
        .selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d.pct))
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(d.value))
        .attr('height', (d) => height - y(d.value))
        .style('fill', colour);

      svg
        .append('g')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis);

      svg.append('g').call(yAxis);
    });
  }

  // getter and setter functions. See Mike Bostocks post "Towards Reusable Charts" for a tutorial on how this works.
  chart.width = function (value) {
    if (!arguments.length) return width;
    width = value;
    return chart;
  };

  chart.height = function (value) {
    if (!arguments.length) return height;
    height = value;
    return chart;
  };

  chart.margin = function (value) {
    if (!arguments.length) return margin;
    margin = value;
    return chart;
  };

  chart.colour = function (value) {
    if (!arguments.length) return colour;
    colour = value;
    return chart;
  };

  return chart;
}

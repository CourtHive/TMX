import {
  axisBottom,
  scaleLinear,
  scaleOrdinal,
  scaleTime,
  schemeCategory10,
  line as d3Line,
  select as d3Select,
  max as d3Max
} from 'd3';
import { keyWalk } from 'functions/keyWalk';

export const timeSeries = function () {
  let o = {
    selector: undefined,

    cleanup: false, // first remove all svg from root
    sizeToFit: true,
    width: undefined,
    height: undefined,
    minWidth: undefined,
    minHeight: undefined,

    label: true,
    end_label: true,
    invert: false,
    labelPadding: 3,
    datapoints: false,

    margins: {
      top: 30,
      left: 50,
      right: 50,
      bottom: 30
    }
  };

  let data = [];
  let cwidth;
  let cheight;

  let events = {
    datapoints: { mouseover: null }
  };

  function chart(opts) {
    let root = d3Select(o.selector || 'body');
    if (o.cleanup) root.selectAll('svg').remove();

    if (!data.length) return;

    if (o.sizeToFit || opts?.sizeToFit) {
      let dims = root.node().getBoundingClientRect();
      cwidth = Math.max(dims.width, o.minWidth || 0) - o.margins.left - o.margins.right;
      cheight = Math.max(dims.height, o.minHeight || 0) - o.margins.top - o.margins.bottom;
    } else {
      cwidth = (o.width || Math.max(window.innerWidth, o.minWidth || 0)) - o.margins.left - o.margins.right;
      cheight = (o.height || Math.max(window.innerHeight, o.minHeight || 0)) - o.margins.top - o.margins.bottom;
    }

    cwidth = cwidth > 0 ? cwidth : o.width;
    cheight = cheight > 0 ? cheight : o.height;

    let svg = root
      .append('svg')
      .attr('width', cwidth + o.margins.left + o.margins.right)
      .attr('height', cheight + o.margins.top + o.margins.bottom);

    const translate = 'translate(' + o.margins.left + ',' + o.margins.top + ')';
    let ranklines = svg.append('g').attr('transform', translate);
    let rankvalues = svg.append('g').attr('transform', translate);

    let x = scaleTime()
      .domain([data[0].date, data[data.length - 1].date])
      .range([0, cwidth - o.margins.left - o.margins.right]);

    let series = data.columns.slice(1).map(function (key) {
      return data.map(function (d) {
        return {
          key: key,
          date: new Date(d.date),
          value: d[key]
        };
      });
    });

    let maxY = d3Max(series, (s) => d3Max(s, (d) => d.value));
    let y = scaleLinear()
      .domain(o.invert ? [maxY, 0] : [0, maxY])
      .range([cheight - o.margins.top - o.margins.bottom, 0]);

    let z = scaleOrdinal(schemeCategory10);

    ranklines
      .append('g')
      .attr('class', 'ts-axis')
      .attr('transform', 'translate(0,' + cheight + ')')
      .call(axisBottom(x));

    let serie = ranklines.selectAll('.serie').data(series).enter().append('g').attr('class', 'serie');

    let serielabel = rankvalues.selectAll('.serielabel').data(series).enter().append('g').attr('class', 'serielabel');

    serie
      .append('path')
      .attr('class', 'ts-line')
      .style('stroke', (d) => z(d[0].key))
      .attr(
        'd',
        d3Line()
          .defined(function (d) {
            return d?.value;
          })
          .x((d) => x(d.date))
          .y((d) => y(d.value))
      );

    const transform = (d) => 'translate(' + x(d.date) + ',' + (d.value ? y(d.value) : 0) + ')';
    let label_background = serie
      .selectAll('.ts-label')
      .data((d) => d)
      .enter()
      .append('g')
      .attr('class', 'ts-label')
      .attr('transform', transform);

    label_background
      .append('text')
      .attr('dy', '.35em')
      .attr('opacity', lineLabels)
      .text((d) => d.value)
      .filter((d, i) => i === data.length - 1)
      .append('tspan')
      .attr('class', 'ts-label-key')
      .text((d) => ' ' + d.key);

    label_background
      .append('rect')
      .datum(function () {
        return this.previousSibling.getBBox();
      })
      .attr('opacity', lineLabels)
      .attr('x', (d) => d.x - o.labelPadding)
      .attr('y', (d) => d.y - o.labelPadding)
      .attr('width', (d) => d.width + 2 * o.labelPadding)
      .attr('height', (d) => d.height + 2 * o.labelPadding);

    let label = serielabel
      .selectAll('.ts-label-spacer')
      .data((d) => d)
      .enter()
      .append('g')
      .attr('class', 'ts-label-spacer')
      .attr('transform', transform);

    label
      .append('text')
      .attr('dy', '.35em')
      .attr('opacity', lineLabels)
      .text((d) => d.value)
      .filter((d, i) => i === data.length - 1)
      .append('tspan')
      .attr('class', 'ts-label-key')
      .text((d) => ' ' + d.key);

    label.selectAll('rect').lower();

    if (o.datapoints && !o.lables) {
      serie
        .selectAll('.ts-datum')
        .data((d) => d)
        .enter()
        .append('circle')
        .attr('class', 'ts-datum')
        .attr('r', 2)
        .style('fill', (d) => z(d.key))
        .attr('transform', transform)
        .on('mouseover', events.datapoints.mouseover);
    }

    function lineLabels(d, i) {
      return o.label || (i === data.length - 1 && o.end_label) ? 1 : 0;
    }
  }

  chart.selector = (value) => {
    if (!value) {
      return o.selector;
    }
    o.selector = value;
    return chart;
  };

  chart.width = (value) => {
    if (!value) {
      return o.width;
    }
    o.width = value;
    return chart;
  };

  chart.height = (value) => {
    if (!value) {
      return o.height;
    }
    o.height = value;
    return chart;
  };

  chart.sizeToFit = (value) => {
    if (!value) {
      return o.sizeToFit;
    }
    o.sizeToFit = value;
    return chart;
  };

  chart.options = (values) => {
    if (!values) return o;
    keyWalk(values, o);
    return chart;
  };

  chart.events = (functions) => {
    if (!functions) return events;
    keyWalk(functions, events);
    return chart;
  };

  chart.data = (value) => {
    if (!arguments.length) {
      return data;
    }
    data = value;
    return chart;
  };

  /*
   function maxValue(obj_arr) {
      return d3Max(obj_arr.map(obj => d3Max(Object.keys(obj).map(m=>typeof obj[m].getMonth != 'function' ? obj[m] : 0))));
   }
   */

  return chart;
};

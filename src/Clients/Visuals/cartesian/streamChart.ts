module powerbi.visuals {

    interface StreamChartMeasureMetadata {
        idx: {
            x?: number;
            y?: number;
            size?: number;
        };
        cols: {
            x?: DataViewMetadataColumn;
            y?: DataViewMetadataColumn;
            size?: DataViewMetadataColumn;
        };
        axesLabels: ChartAxesLabels;
    }

    interface ScatterChartMeasureMetadata {
        idx: {
            x?: number;
            y?: number;
            size?: number;
        };
        cols: {
            x?: DataViewMetadataColumn;
            y?: DataViewMetadataColumn;
            size?: DataViewMetadataColumn;
        };
        axesLabels: ChartAxesLabels;
    }

    export class StreamChart implements ICartesianVisual, IInteractiveVisual {

        private static ClassName = 'streamChart';
        private static MainGraphicsContextClassName = 'mainGraphicsContext';

        private animator: IGenericAnimator;
        private interactivityService: IInteractivityService;
        private options: VisualInitOptions;
        private svg: D3.Selection;
        private element: JQuery;
        private currentViewport: IViewport;
        private host: IVisualHostServices;
        private colors: IDataColorPalette;
        private data: ScatterChartData;
        private dataView: DataView;
        private style: IVisualStyle;
        private interactivity: InteractivityOptions;
        private cartesianVisualHost: ICartesianVisualHost;
        private isInteractiveChart: boolean;
        private mainGraphicsG: D3.Selection;
        private clearCatcher: D3.Selection;
        private mainGraphicsContext: D3.Selection;
        private categoryAxisProperties: DataViewObject;
        private valueAxisProperties: DataViewObject;

        constructor(options: ScatterChartConstructorOptions) {
            if (options) {
                this.interactivityService = options.interactivityService;
                this.animator = options.animator;
            }
        }

        public init(options: CartesianVisualInitOptions): void {
            this.options = options;
            var element = this.element = options.element;
            this.currentViewport = options.viewport;
            this.style = options.style;
            this.host = options.host;
            this.colors = this.style.colorPalette.dataColors;
            this.interactivity = options.interactivity;
            this.cartesianVisualHost = options.cartesianHost;
            this.isInteractiveChart = options.interactivity && options.interactivity.isInteractiveLegend;

            element.addClass(StreamChart.ClassName);
            var svg = this.svg = options.svg;
            this.clearCatcher = this.svg.select(".clearCatcher");

            this.mainGraphicsG = svg.append('g')
                .classed(StreamChart.MainGraphicsContextClassName, true);

            this.mainGraphicsContext = this.mainGraphicsG.append('svg');
        }

        public static converter(dataView: DataView, currentViewport: IViewport, colorPalette: IDataColorPalette, interactivityService?: IInteractivityService, categoryAxisProperties?: DataViewObject, valueAxisProperties?: DataViewObject): ScatterChartData {
            var categoryValues: any[],
                categoryFormatter: IValueFormatter,
                categoryObjects: DataViewObjects[],
                categoryIdentities: DataViewScopeIdentity[],
                categoryQueryName: string;

            var dataViewCategorical: DataViewCategorical = dataView.categorical;
            var dataViewMetadata: DataViewMetadata = dataView.metadata;

            if (dataViewCategorical.categories && dataViewCategorical.categories.length > 0) {
                categoryValues = dataViewCategorical.categories[0].values;
                categoryFormatter = valueFormatter.create({ format: valueFormatter.getFormatString(dataViewCategorical.categories[0].source, scatterChartProps.general.formatString), value: categoryValues[0], value2: categoryValues[categoryValues.length - 1] });
                categoryIdentities = dataViewCategorical.categories[0].identity;
                categoryObjects = dataViewCategorical.categories[0].objects;
                categoryQueryName = dataViewCategorical.categories[0].source.queryName;
            }
            else {
                categoryValues = [null];
                // creating default formatter for null value (to get the right string of empty value from the locale)
                categoryFormatter = valueFormatter.createDefaultFormatter(null);
            }

            var categories = dataViewCategorical.categories;
            var dataValues = dataViewCategorical.values;
            var hasDynamicSeries = !!dataValues.source;
            var grouped = dataValues.grouped();
            var dvSource = dataValues.source;
            var scatterMetadata = StreamChart.getMetadata(grouped, dvSource);
            var dataLabelsSettings = dataLabelUtils.getDefaultPointLabelSettings();
            var fillPoint = false;

            if (dataViewMetadata && dataViewMetadata.objects) {
                var objects = dataViewMetadata.objects;

                var defaultDataPointColor = DataViewObjects.getFillColor(objects, columnChartProps.dataPoint.defaultColor);
                var showAllDataPoints = DataViewObjects.getValue<boolean>(objects, columnChartProps.dataPoint.showAllDataPoints);

                var labelsObj = objects['categoryLabels'];
                if (labelsObj) {
                    dataLabelsSettings.show = (labelsObj['show'] !== undefined) ? <boolean>labelsObj['show'] : dataLabelsSettings.show;
                    dataLabelsSettings.precision = (labelsObj['labelsPrecision'] !== undefined) ? +<string>labelsObj['labelsPrecision'] : dataLabelsSettings.precision;
                    if (labelsObj['color'] !== undefined) {
                        dataLabelsSettings.labelColor = (<Fill>labelsObj['color']).solid.color;
                    }
                }

                fillPoint = DataViewObjects.getValue(objects, scatterChartProps.fillPoint.show, fillPoint);
            }

            var dataPoints = StreamChart.createDataPoints(
                dataValues,
                scatterMetadata,
                categories,
                categoryValues,
                categoryFormatter,
                categoryIdentities,
                categoryObjects,
                colorPalette,
                currentViewport,
                hasDynamicSeries,
                dataLabelsSettings,
                defaultDataPointColor,
                categoryQueryName);

            if (interactivityService) {
                interactivityService.applySelectionStateToData(dataPoints);
            }

            var legendItems = hasDynamicSeries
                ? StreamChart.createSeriesLegend(dataValues, colorPalette, dataValues, valueFormatter.getFormatString(dvSource, scatterChartProps.general.formatString), defaultDataPointColor)
                : [];

            var legendTitle = dataValues && dvSource ? dvSource.displayName : "";
            if (!legendTitle) {
                legendTitle = categories && categories[0].source.displayName ? categories[0].source.displayName : "";
            }

            var legendData = { title: legendTitle, dataPoints: legendItems };

            var sizeRange = StreamChart.getSizeRangeForGroups(grouped, scatterMetadata.idx.size);

            if (categoryAxisProperties && categoryAxisProperties["showAxisTitle"] !== null && categoryAxisProperties["showAxisTitle"] === false) {
                scatterMetadata.axesLabels.x = null;
            }
            if (valueAxisProperties && valueAxisProperties["showAxisTitle"] !== null && valueAxisProperties["showAxisTitle"] === false) {
                scatterMetadata.axesLabels.y = null;
            }

            return {
                xCol: scatterMetadata.cols.x,
                yCol: scatterMetadata.cols.y,
                dataPoints: dataPoints,
                legendData: legendData,
                axesLabels: scatterMetadata.axesLabels,
                hasSelection: false,
                selectedIds: [],
                size: scatterMetadata.cols.size,
                sizeRange: sizeRange,
                dataLabelsSettings: dataLabelsSettings,
                defaultDataPointColor: defaultDataPointColor,
                hasDynamicSeries: hasDynamicSeries,
                showAllDataPoints: showAllDataPoints,
                fillPoint: fillPoint,
            };
        }

        private static createDataPoints(
            dataValues: DataViewValueColumns,
            metadata: StreamChartMeasureMetadata,
            categories: DataViewCategoryColumn[],
            categoryValues: any[],
            categoryFormatter: IValueFormatter,
            categoryIdentities: DataViewScopeIdentity[],
            categoryObjects: DataViewObjects[],
            colorPalette: IDataColorPalette,
            viewport: IViewport,
            hasDynamicSeries: boolean,
            labelSettings: PointDataLabelsSettings,
            defaultDataPointColor?: string,
            categoryQueryName?: string): ScatterChartDataPoint[] {

            var dataPoints: ScatterChartDataPoint[] = [],
                indicies = metadata.idx,
                formatStringProp = scatterChartProps.general.formatString,
                dataValueSource = dataValues.source,
                grouped = dataValues.grouped();

            var colorHelper = new ColorHelper(colorPalette, scatterChartProps.dataPoint.fill, defaultDataPointColor);

            for (var categoryIdx = 0, ilen = categoryValues.length; categoryIdx < ilen; categoryIdx++) {
                var categoryValue = categoryValues[categoryIdx];

                for (var seriesIdx = 0, len = grouped.length; seriesIdx < len; seriesIdx++) {
                    var grouping = grouped[seriesIdx];
                    var seriesValues = grouping.values;
                    var measureX = ScatterChart.getMeasureValue(indicies.x, seriesValues);
                    var measureY = ScatterChart.getMeasureValue(indicies.y, seriesValues);
                    var measureSize = ScatterChart.getMeasureValue(indicies.size, seriesValues);

                    var xVal = measureX && measureX.values ? measureX.values[categoryIdx] : null;
                    var yVal = measureY && measureY.values ? measureY.values[categoryIdx] : 0;
                    var size = measureSize && measureSize.values ? measureSize.values[categoryIdx] : null;

                    var hasNullValue = (xVal == null) || (yVal == null);

                    if (hasNullValue)
                        continue;

                    var color: string;
                    if (hasDynamicSeries) {
                        color = colorHelper.getColorForSeriesValue(grouping.objects, dataValues.identityFields, grouping.name);
                    }
                    else {
                        // If we have no Size measure then use a blank query name
                        var measureSource = (measureSize != null)
                            ? measureSize.source.queryName
                            : '';

                        color = colorHelper.getColorForMeasure(categoryObjects && categoryObjects[categoryIdx], measureSource);
                    }

                    let category = categories && categories.length > 0 ? categories[0] : null;
                    var identity = SelectionIdBuilder.builder()
                        .withCategory(category, categoryIdx)
                        .withSeries(dataValues, grouping)
                        .createSelectionId();

                    var seriesData: TooltipSeriesDataItem[] = [];
                    if (dataValueSource) {
                        // Dynamic series
                        seriesData.push({ value: grouping.name, metadata: { source: dataValueSource, values: [] } });
                    }
                    if (measureX) {
                        seriesData.push({ value: xVal, metadata: measureX });
                    }
                    if (measureY) {
                        seriesData.push({ value: yVal, metadata: measureY });
                    }
                    if (measureSize && measureSize.values && measureSize.values.length > 0) {
                        seriesData.push({ value: measureSize.values[categoryIdx], metadata: measureSize });
                    }

                    var tooltipInfo: TooltipDataItem[] = TooltipBuilder.createTooltipInfo(formatStringProp, null, categoryValue, null, categories, seriesData);

                    var dataPoint: ScatterChartDataPoint = {
                        x: xVal,
                        y: yVal,
                        size: size,
                        radius: { sizeMeasure: measureSize, index: categoryIdx },
                        fill: color,
                        category: categoryFormatter.format(categoryValue),
                        selected: false,
                        identity: identity,
                        tooltipInfo: tooltipInfo,
                        labelFill: labelSettings.labelColor,
                    };

                    dataPoints.push(dataPoint);
                }
            }
            return dataPoints;
        }

        private static getSizeRangeForGroups(
            dataViewValueGroups: DataViewValueColumnGroup[],
            sizeColumnIndex: number): NumberRange {

            var result: NumberRange = {};
            if (dataViewValueGroups) {
                dataViewValueGroups.forEach((group) => {
                    var sizeColumn = ScatterChart.getMeasureValue(sizeColumnIndex, group.values);
                    var currentRange: NumberRange = AxisHelper.getRangeForColumn(sizeColumn);
                    if (result.min == null || result.min > currentRange.min) {
                        result.min = currentRange.min;
                    }
                    if (result.max == null || result.max < currentRange.max) {
                        result.max = currentRange.max;
                    }
                });
            }
            return result;
        }

        private static createSeriesLegend(
            dataValues: DataViewValueColumns,
            colorPalette: IDataColorPalette,
            categorical: DataViewValueColumns,
            formatString: string,
            defaultDataPointColor: string): LegendDataPoint[] {

            var grouped = dataValues.grouped();
            var colorHelper = new ColorHelper(colorPalette, scatterChartProps.dataPoint.fill, defaultDataPointColor);

            var legendItems: LegendDataPoint[] = [];
            for (var i = 0, len = grouped.length; i < len; i++) {
                var grouping = grouped[i];
                var color = colorHelper.getColorForSeriesValue(grouping.objects, dataValues.identityFields, grouping.name);
                legendItems.push({
                    color: color,
                    icon: LegendIcon.Circle,
                    label: valueFormatter.format(grouping.name, formatString),
                    identity: grouping.identity ? SelectionId.createWithId(grouping.identity) : SelectionId.createNull(),
                    selected: false
                });
            }

            return legendItems;
        }

        private static getMetadata(grouped: DataViewValueColumnGroup[], source: DataViewMetadataColumn): StreamChartMeasureMetadata {
            var xIndex = DataRoleHelper.getMeasureIndexOfRole(grouped, 'X');
            var yIndex = DataRoleHelper.getMeasureIndexOfRole(grouped, 'Y');
            var sizeIndex = DataRoleHelper.getMeasureIndexOfRole(grouped, 'Size');
            var xCol: DataViewMetadataColumn;
            var yCol: DataViewMetadataColumn;
            var sizeCol: DataViewMetadataColumn;
            var xAxisLabel = "";
            var yAxisLabel = "";

            if (grouped && grouped.length) {
                var firstGroup = grouped[0],
                    measureCount = firstGroup.values.length;

                if (!(xIndex >= 0))
                    xIndex = StreamChart.getDefaultMeasureIndex(measureCount, yIndex, sizeIndex);
                if (!(yIndex >= 0))
                    yIndex = StreamChart.getDefaultMeasureIndex(measureCount, xIndex, sizeIndex);
                if (!(sizeIndex >= 0))
                    sizeIndex = StreamChart.getDefaultMeasureIndex(measureCount, xIndex, yIndex);

                if (xIndex >= 0) {
                    xCol = firstGroup.values[xIndex].source;
                    xAxisLabel = firstGroup.values[xIndex].source.displayName;
                }
                if (yIndex >= 0) {
                    yCol = firstGroup.values[yIndex].source;
                    yAxisLabel = firstGroup.values[yIndex].source.displayName;
                }
                if (sizeIndex >= 0) {
                    sizeCol = firstGroup.values[sizeIndex].source;
                }
            }

            return {
                idx: {
                    x: xIndex,
                    y: yIndex,
                    size: sizeIndex,
                },
                cols: {
                    x: xCol,
                    y: yCol,
                    size: sizeCol,
                },
                axesLabels: {
                    x: xAxisLabel,
                    y: yAxisLabel
                }
            };
        }

        private static getDefaultMeasureIndex(count: number, usedIndex: number, usedIndex2: number): number {
            for (var i = 0; i < count; i++) {
                if (i !== usedIndex && i !== usedIndex2)
                    return i;
            }
        }

        public setData(dataViews: DataView[]): void {
            this.data = {
                xCol: undefined,
                yCol: undefined,
                dataPoints: [],
                legendData: { dataPoints: [] },
                axesLabels: { x: '', y: '' },
                selectedIds: [],
                sizeRange: [],
                dataLabelsSettings: dataLabelUtils.getDefaultPointLabelSettings(),
                defaultDataPointColor: null,
                hasDynamicSeries: false,
            };

            if (dataViews.length > 0) {
                var dataView = dataViews[0];

                if (dataView) {
                    this.categoryAxisProperties = CartesianHelper.getCategoryAxisProperties(dataView.metadata, true);
                    this.valueAxisProperties = CartesianHelper.getValueAxisProperties(dataView.metadata, true);
                    this.dataView = dataView;

                    if (dataView.categorical && dataView.categorical.values) {
                        this.data = StreamChart.converter(dataView, this.currentViewport, this.colors, this.interactivityService, this.categoryAxisProperties, this.valueAxisProperties);
                    }

                }
            }
        }

        public accept(visitor: InteractivityVisitor, options: any): void {

        }

        public calculateAxesProperties(options: CalculateScaleAndDomainOptions): IAxisProperties[] {
            return [];
        }

        public overrideXScale(xProperties: IAxisProperties): void {

        }

        public render(suppressAnimations: boolean): void {

        }

        public calculateLegend(): LegendData {
            return null;
        }

        public hasLegend(): boolean {
            return false;
        }

        public onClearSelection(): void {

        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
            return null;
        }

        public getVisualCategoryAxisIsScalar(): boolean {
            return true;
        }

        //public getSupportedCategoryAxisType?(): string {
        //    return "";
        //}

        //public getPreferredPlotArea?(isScalar: boolean, categoryCount: number, categoryThickness: number): IViewport;
        //public setFilteredData?(startIndex: number, endIndex: number): CartesianData;
    }

}
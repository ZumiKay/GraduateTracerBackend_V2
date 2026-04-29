"use strict";
/**
 * Analytics Types for Choice Question Graph Visualization
 * Supports Multiple Graph Types: Bar Chart, Pie Chart, Horizontal Bar, Doughnut
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionType = exports.GraphType = void 0;
var GraphType;
(function (GraphType) {
    GraphType["BAR"] = "bar";
    GraphType["PIE"] = "pie";
    GraphType["LINE"] = "line";
    GraphType["DOUGHNUT"] = "doughnut";
    GraphType["HORIZONTAL_BAR"] = "horizontalBar";
})(GraphType || (exports.GraphType = GraphType = {}));
var QuestionType;
(function (QuestionType) {
    QuestionType["MultipleChoice"] = "multiple";
    QuestionType["CheckBox"] = "checkbox";
    QuestionType["Text"] = "texts";
    QuestionType["Number"] = "number";
    QuestionType["Date"] = "date";
    QuestionType["RangeDate"] = "rangedate";
    QuestionType["Selection"] = "selection";
    QuestionType["RangeNumber"] = "rangenumber";
    QuestionType["ShortAnswer"] = "shortanswer";
    QuestionType["Paragraph"] = "paragraph";
})(QuestionType || (exports.QuestionType = QuestionType = {}));

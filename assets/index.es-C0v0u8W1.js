import{a as e}from"./rolldown-runtime-B0Z9INg1.js";import{F as t,p as n}from"./index-COG4z50o.js";var r=e(t()),i=e(n());function a(e,t){return t={exports:{}},e(t,t.exports),t.exports}var o=a(function(e){(function(){var t={}.hasOwnProperty;function n(){for(var e=[],r=0;r<arguments.length;r++){var i=arguments[r];if(i){var a=typeof i;if(a===`string`||a===`number`)e.push(i);else if(Array.isArray(i)){if(i.length){var o=n.apply(null,i);o&&e.push(o)}}else if(a===`object`){if(i.toString===Object.prototype.toString)for(var s in i)t.call(i,s)&&i[s]&&e.push(s);else e.push(i.toString())}}}return e.join(` `)}e.exports?(n.default=n,e.exports=n):window.classNames=n})()});function s(e,t){t===void 0&&(t={});var n=t.insertAt;if(!(!e||typeof document>`u`)){var r=document.head||document.getElementsByTagName(`head`)[0],i=document.createElement(`style`);i.type=`text/css`,n===`top`&&r.firstChild?r.insertBefore(i,r.firstChild):r.appendChild(i),i.styleSheet?i.styleSheet.cssText=e:i.appendChild(document.createTextNode(e))}}s(`.shimmer-button {
  border-radius: 4px;
  height: 38px;
  width: 120px;
  margin-bottom: 20px; }
  .shimmer-button--sm {
    border-radius: 3px;
    height: 31px;
    width: 100px; }
  .shimmer-button--lg {
    height: 48px;
    width: 140px;
    border-radius: 5px; }
`);var c=function(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e};i.default.oneOf([`lg`,`md`,`sm`]);var l=function(e){var t=e.size,n=e.center,i=e.className,a={};return t&&(a.width=t+`px`,a.height=t+`px`),r.createElement(`div`,{className:o({"text-center":n})},r.createElement(`div`,{style:a,className:o(c({"shimmer shimmer-avatar":!0},i,i))}))};l.propTypes={size:i.default.number,center:i.default.bool,className:i.default.string},l.defaultProps={center:!1,size:80};var u=function(e){var t=e.height,n=e.width,i=e.center,a=e.className,s=e.fitOnFrame,l=e.rounded,u={};return t&&(u.height=t+`px`),n&&(u.width=n+`px`),r.createElement(`div`,{className:o({"h-100":s,"text-center ":i})},r.createElement(`div`,{className:o(c({"h-100":s,"shimmer shimmer-thumbnail":!0,"border-rounded":l},a,a)),style:u}))};u.propTypes={height:i.default.number,width:i.default.number,center:i.default.bool,className:i.default.string,fitOnFrame:i.default.bool,rounded:i.default.bool},u.defaultProps={canter:!1,fitOnFrame:!1,rounded:!1,height:250},s(`.shimmer-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 20px;
  display: inline-block; }

.shimmer-thumbnail {
  min-width: 80px;
  width: 100%;
  height: 200px;
  margin-bottom: 20px;
  display: inline-block; }
`),s(`.shimmer-title {
  margin-bottom: 20px; }
  .shimmer-title--secondary {
    margin-bottom: 20px; }
    .shimmer-title--secondary .shimmer-title-line {
      height: 16px; }
  .shimmer-title-line {
    width: 100%;
    height: 24px;
    border-radius: 20px; }
    .shimmer-title-line:first-child {
      width: 100% !important; }
    .shimmer-title-line:last-child {
      width: 40%; }
`);var d=function(e){var t,n=e.line,i=e.gap,a=e.variant,s=e.className;return r.createElement(`div`,{className:o((t={grid:!0,"shimmer-title":a===`primary`,"shimmer-title--secondary":a===`secondary`},c(t,`grid-gap-`+i,i),c(t,s,s),t))},function(){for(var e=[],t=0;t<n;t++)e.push(r.createElement(`div`,{className:`shimmer shimmer-title-line`,key:t}));return e}())};d.propTypes={line:i.default.number,gap:i.default.oneOf([10,15,20,30]),variant:i.default.oneOf([`primary`,`secondary`]),className:i.default.string},d.defaultProps={line:2,gap:10,variant:`primary`},s(`.shimmer-card {
  border-radius: 8px;
  box-shadow: 0 0px 10px rgba(0, 0, 0, 0.1);
  background-color: #ffffff;
  width: 100%; }
  .shimmer-card:not(:first-child) {
    margin-top: 30px; }
  .shimmer-card--content-center {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center; }
    .shimmer-card--content-center * {
      width: 100%;
      margin: auto; }
`),i.default.string,i.default.oneOfType([i.default.element,i.default.array]).isRequired,i.default.oneOf([!1,20,30]),i.default.number,i.default.oneOf([2,3,4]),i.default.oneOf([20,30]),i.default.bool,i.default.oneOf([`thumbnail`,`circular`]),i.default.number,i.default.bool,i.default.bool,s(`.shimmer-gallery-puzzle {
  height: 540px; }

.circular-image-caption .shimmer-title-line {
  margin: auto; }
`),i.default.number,i.default.oneOf([2,3,4]),i.default.oneOf([20,30]),i.default.bool,i.default.number,i.default.number.isRequired,i.default.bool,s(`.shimmer-table-row {
  box-shadow: 0 0px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  padding: 25px 0;
  background-color: #ffffff;
  border-radius: 5px;
  margin-bottom: 20px; }
  .shimmer-table-row--header {
    background-color: transparent;
    box-shadow: none;
    margin: 0; }
  .shimmer-table-row > .shimmer {
    margin: 0 30px; }

.shimmer-table-col {
  width: 100%;
  height: 10px;
  border-radius: 10px; }
`),i.default.number,i.default.number,s(`.shimmer-badge {
  width: 80px;
  height: 24px;
  border-radius: 20px;
  margin-bottom: 20px; }
`),i.default.number,s(`.shimmer-text {
  margin-bottom: 30px; }
  .shimmer-text-line {
    width: 100%;
    height: 8px;
    border-radius: 10px; }
    .shimmer-text-line:first-child {
      width: 100% !important; }
    .shimmer-text-line:last-child {
      width: 40%; }
`);var f=function(e){var t,n=e.line,i=e.gap,a=e.className;return r.createElement(`div`,{className:o((t={"grid shimmer-text":!0},c(t,`grid-gap-`+i,i),c(t,a,a),t))},function(){for(var e=[],t=0;t<n;t++)e.push(r.createElement(`div`,{className:`shimmer shimmer-text-line`,key:t}));return e}())};f.propTypes={line:i.default.number,gap:i.default.oneOf([10,15,20,30]),className:i.default.string},f.defaultProps={line:5,gap:15},s(`.shimmer-separator {
  height: 1px;
  background-color: #dddddd;
  margin: 40px 0; }
`),i.default.oneOf([`text`,`image`,`both`]),i.default.bool,i.default.bool.isRequired,i.default.oneOf([`circular`,`thumbnail`]),i.default.number,i.default.number,i.default.bool,i.default.bool,i.default.bool,i.default.bool,i.default.bool,i.default.number,i.default.oneOf([`STYLE_ONE`,`STYLE_TWO`,`STYLE_THREE`,`STYLE_FOUR`,`STYLE_FIVE`,`STYLE_SIX`,`STYLE_SEVEN`]),i.default.oneOf([`SIMPLE`,`EDITOR`]),i.default.bool,i.default.bool,i.default.bool,i.default.bool,i.default.bool,i.default.oneOf([`circular`,`thumbnail`]),i.default.number,i.default.number,i.default.number,i.default.oneOf([2,3,4]),i.default.oneOf([20,30]),i.default.oneOf([`STYLE_ONE`,`STYLE_TWO`,`STYLE_THREE`,`STYLE_FOUR`,`STYLE_FIVE`,`STYLE_SIX`,`STYLE_SEVEN`,`STYLE_EIGHT`]),i.default.bool,i.default.bool,i.default.bool,i.default.bool,i.default.number,i.default.number,i.default.bool,i.default.bool,i.default.bool,i.default.bool,s(`.shimmer {
  background: linear-gradient(to right, #f6f6f6 8%, #f0f0f0 18%, #f6f6f6 33%);
  background-size: 1000px 100%;
  animation: shimmer 2.2s linear infinite forwards; }

@-webkit-keyframes shimmer {
  0% {
    background-position: -100% 0; }
  100% {
    background-position: 100% 0; } }

@keyframes shimmer {
  0% {
    background-position: -1000px 0; }
  100% {
    background-position: 1000px 0; } }

/*
=====
Padding Styles
=====
*/
.p-30 {
  padding: 30px; }

.p-20 {
  padding: 20px; }

.p-15 {
  padding: 15px; }

/*
=====
Margin Styles
=====
*/
.m-0 {
  margin: 0; }

.m-auto {
  margin: auto; }

.ml-auto {
  margin-left: auto; }

.mr-auto {
  margin-right: auto; }

.m-15 {
  margin: 15px; }

.m-30 {
  margin: 30px; }

.mb-0 {
  margin-bottom: 0px; }

.mb-10 {
  margin-bottom: 10px; }

.mb-15 {
  margin-bottom: 15px; }

.mb-20 {
  margin-bottom: 20px; }

.mt-15 {
  margin-top: 15px; }

.mb-30 {
  margin-bottom: 30px; }

.mb-40 {
  margin-bottom: 40px; }

/*
=======
Content Size Styles
=======
*/
.w-10 {
  width: 10%; }

.w-20 {
  width: 20%; }

.w-30 {
  width: 30%; }

.w-40 {
  width: 40%; }

.w-50 {
  width: 50%; }

.w-60 {
  width: 60%; }

.w-70 {
  width: 70%; }

.w-80 {
  width: 80%; }

/*
========
Flex Styles
========
*/
.flex {
  display: flex; }

.flex-direction-column {
  flex-direction: column; }

.flex-horizontal-center {
  display: flex;
  flex-direction: column;
  align-items: center; }

.flex-vertical-center {
  align-items: center; }

.flex-content-between {
  justify-content: space-between; }

.flex-reverse {
  flex-direction: row-reverse; }

.flex-1 {
  flex-grow: 1; }

/*
=======
Grid Styles
=======
*/
.grid {
  display: grid; }

.grid-gap-10 {
  gap: 10px; }

.grid-gap-15 {
  gap: 15px; }

.grid-gap-20 {
  gap: 20px; }

.grid-gap-30 {
  gap: 30px; }

.grid-column-2 {
  grid-template-columns: auto auto; }

.grid-column-3 {
  grid-template-columns: auto auto auto; }

.grid-column-4 {
  grid-template-columns: auto auto auto auto; }

.text-center {
  text-align: center; }

.border-rounded {
  border-radius: 4px; }

.h-100 {
  height: 100% !important; }

.shimmer-hr {
  border-color: #f6f6f6; }

.shimmer-row {
  display: flex;
  margin: 0 -15px; }
  .shimmer-row .shimmer-col,
  .shimmer-row [class*="shimmer-col-"] {
    padding-left: 15px;
    padding-right: 15px;
    flex-basis: 0;
    flex-grow: 1;
    max-width: 100%; }
`);export{d as i,f as n,u as r,l as t};
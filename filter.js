var optionAll = document.querySelector("#filter-all");
var optionItaliaans = document.querySelector("#filter-italiaans");
var optionMexicaans = document.querySelector("#filter-mexicaans");
var optionJapans = document.querySelector("#filter-japans");


optionAll.addEventListener("change", filterList);
optionItaliaans.addEventListener("change", filterList);
optionMexicaans.addEventListener("change", filterList);
optionJapans  .addEventListener("change", filterList);


function filterList(event){

  let deLijst = document.querySelector("ul");
  let nieuweFilter = event.target.value;
  deLijst.className = "";
  deLijst.classList.add(nieuweFilter);
}
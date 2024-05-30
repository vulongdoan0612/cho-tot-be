
const convertToSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/ /g, "-")
    .normalize("NFD") 
    .replace(/[\u0300-\u036f]/g, ""); 
}
export default convertToSlug
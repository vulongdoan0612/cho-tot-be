
const convertToSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/ /g, "-") // Thay thế khoảng trắng bằng dấu gạch ngang
    .normalize("NFD") // Chuẩn hóa Unicode
    .replace(/[\u0300-\u036f]/g, ""); // Loại bỏ dấu
}
export default convertToSlug
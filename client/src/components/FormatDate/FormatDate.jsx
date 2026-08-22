const FormatDate = (value) => {
    const date = new Date(value);
    const pad = (number) => String(number).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} 
    ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default FormatDate;
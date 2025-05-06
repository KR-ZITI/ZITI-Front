navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => alert("마이크 접근 성공"))
  .catch((err) => alert("마이크 접근 실패: " + err.name));
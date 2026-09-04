(function () {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');

  if (button) {
    button.addEventListener('click', function () {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  }

  document.querySelectorAll('.post-content pre code').forEach(function (code) {
    const text = code.textContent.trim();

    if (
      text.includes('정답 완전 일치') &&
      text.includes('Jaccard') &&
      text.includes('직접 충돌') &&
      text.includes('46.4%') &&
      text.includes('69.4%') &&
      text.includes('3.4%')
    ) {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>지표</th>
            <th>결과</th>
            <th>의미</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>정답 완전 일치</strong></td>
            <td><strong>46.4%</strong></td>
            <td>두 정답지가 동일한 키워드 집합을 선택</td>
          </tr>
          <tr>
            <td><strong>Jaccard 유사도</strong></td>
            <td><strong>69.4%</strong></td>
            <td>두 정답지의 키워드 선택이 전체적으로 겹치는 정도</td>
          </tr>
          <tr>
            <td><strong>직접 충돌</strong></td>
            <td><strong>3.4%</strong></td>
            <td>한쪽은 정답, 다른 쪽은 오답으로 판단</td>
          </tr>
        </tbody>
      `;

      code.parentElement.replaceWith(table);
    }
  });
})();

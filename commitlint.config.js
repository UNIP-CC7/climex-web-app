export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // mensagens em português costumam ter linhas mais longas no corpo
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-max-length': [2, 'always', 100],
  },
}

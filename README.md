# caniuse-web-component

# can-i-use

A web component that shows LTS browser support.

```html
<head>
  <script defer src="/can-i-use.js"></script>
</head>
<body>
  <can-i-use
    type="custom-elementsv1"
    browsers="['firefox', 'chrome', 'edge' , 'safari', 'ie', 'opera']"
  ></can-i-use>
</body>
```

# can-i-use-total

A web component that shows the support percentage for full support, partial support and total support.

```html
<head>
  <script defer src="/can-i-use.js"></script>
</head>
<body>
  <can-i-use-total type="custom-elementsv1"></can-i-use-total>
</body>
```

## development

```bash
npm run dev
```

Navigate to [localhost:5000](http://localhost:5000)

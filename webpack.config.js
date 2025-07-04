const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',  
  output: {
  path: path.resolve(__dirname, 'dist'),
  filename: 'bundle.js',
  clean: true,
  publicPath: '/recentify-frontend/', // <-- match GitHub repo name
  },
  mode: 'development', 
devServer: {
  static: './dist',
  port: 4000,
  host: '127.0.0.1',  // explicitly bind to 127.0.0.1
  open: true,
  historyApiFallback: true,
},
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, 
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],
};

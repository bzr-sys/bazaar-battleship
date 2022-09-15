module.exports = {
  chainWebpack: (config) => {
    config.plugin("html").tap((args) => {
      args[0].title = "Battleship";
      return args;
    });
  },
  css: {
    loaderOptions: {
      sass: {
        prependData: `
          @import "@/scss/_global-variables.scss";
        `,
      },
    },
  },
  pwa: {
    workboxOptions: {
      navigateFallback: "index.html",
    },
  },
};

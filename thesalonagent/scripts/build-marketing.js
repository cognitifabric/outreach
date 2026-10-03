require('esbuild').buildSync({entryPoints:['marketing/workflow-3d.js'],bundle:true,format:'esm',minify:true,target:'es2020',outfile:'workflow-3d.js',legalComments:'linked'});

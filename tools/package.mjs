import {packager} from '@electron/packager';
const paths=await packager({dir:'.',out:'out',name:'Desktop Dragon',appBundleId:'local.desktop-dragon',
 overwrite:true,asar:true,prune:true,icon:'assets/icons/app',
 ignore:[/^\/(\.git|\.github|\.local|docs|out|tools)(\/|$)/,/\.test\.(cjs|mjs)$/,/^\/assets\/references\/(?!attribution\.txt$)/],
});
console.log(paths.join('\n'));

import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, rmSync, rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const dist=resolve(root,'dist');
const remote=process.argv[2]||'https://github.com/BomJacques/remybot.git';
if(!existsSync(join(dist,'index.html')))throw new Error('Run npm run build before deploying.');
function git(args,options={}){
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,...options});
  if(result.status!==0)throw new Error(result.stderr.trim()||'Git command failed');
  return result.stdout.trim();
}
// A separate index publishes only dist, leaving the source checkout untouched.
const scratch=mkdtempSync(join(tmpdir(),'remybot-pages-'));
const env={...process.env,GIT_INDEX_FILE:join(scratch,'index')};
try{
  const remoteRef=git(['ls-remote',remote,'refs/heads/gh-pages']);
  let parent;
  if(remoteRef){git(['fetch',remote,'gh-pages']);parent=git(['rev-parse','FETCH_HEAD']);}
  git(['read-tree','--empty'],{env});
  const gitDir=git(['rev-parse','--absolute-git-dir']);
  git(['--git-dir='+gitDir,'--work-tree='+dist,'add','--all','--force'],{env,cwd:dist});
  const tree=git(['write-tree'],{env});
  if(parent&&git(['rev-parse',parent+'^{tree}'])===tree){console.log('GitHub Pages already has this build.');process.exitCode=0;}
  else{
    const name=git(['log','-1','--format=%an']);
    const email=git(['log','-1','--format=%ae']);
    const source=git(['rev-parse','HEAD']);
    const commit=git(['-c','user.name='+name,'-c','user.email='+email,'commit-tree',tree,...(parent?['-p',parent]:[]),'-m','Publish Remybot '+source],{env});
    // No force: a simultaneous deployment must be retried, never overwritten.
    git(['push',remote,commit+':refs/heads/gh-pages']);
    console.log('Published static build: '+commit);
  }
}finally{
  for(const name of ['index','index.lock'])rmSync(join(scratch,name),{force:true});
  rmdirSync(scratch);
}

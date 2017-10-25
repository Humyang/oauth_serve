import commands
import re
import subprocess

def get_pid_close(port):
    status,output = commands.getstatusoutput('lsof -i:'+str(port))
    if status == 0:
        res = output.split("\n")[1]
        pid = re.findall(r'(\b[0-9]+)',res)
        print pid[0]
        close_api_serve_result,info = commands.getstatusoutput("kill -9 "+str(pid[0]))
        print 'close_api_serve_result',close_api_serve_result
        if close_api_serve_result == 0:
            print "close process is :",pid[0]
            return 1
    return 0

def run_command(command):
    status,info = commands.getstatusoutput(command)
    print command,'result is ',status
    if status == 0:
        return 1
    else:
        print command,'info faile,bcs ',info
        return 0

def subprocess_command(command):
    subprocess.Popen(command,shell=True)
    return 1

# update lastet code from github server.
print 'pull origin master -- begin'
sync_github = run_command('git pull origin master')
if sync_github == 1:
        print 'pull origin master -- success'
        subprocess_command('nohup npm run start &')        
	# close static serve and api serve
        print 'close serve -- begin'
        close_api = get_pid_close(8000)
        if close_api == 1:
            print 'close serve -- success'
            
        else:
            print 'close serve -- faile'
        print 'start serve'
        # start server
        subprocess_command('nohup npm run start &')

import React from 'react'
import Navbar from '~/components/Navbar'
import { useState } from 'react'
import FileUploader from '~/components/FileUploader'
import { usePuterStore } from '~/lib/puter'
import { convertPdfToImage } from '~/lib/pdf2img'
import { generateUUID } from '~/lib/utils'
import { prepareInstructions, AIResponseFormat } from '~/constants'
import { useNavigate } from 'react-router'

const upload = () => {
  const {auth,isLoading,fs,ai,kv} = usePuterStore();
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [File, setFile] = useState<File | null>(null)
  const navigate = useNavigate()

  const handleFileSelect = (file:File|null) =>{
    setFile(file)
  }

  const handleAnalyze = async({companyName, jobTitle, jobDescription, File}: {companyName:string, jobTitle:string, jobDescription:string, File:File}) =>{
      setIsProcessing(true);

      setStatusText("uploading the file....");
      const uploadedFile = await fs.upload([File]);
      if(!uploadedFile) return setStatusText("Error while uploading the file...")

      setStatusText("converting to image...")
      const imageFile = await convertPdfToImage(File);
      if(!imageFile.file) {
        const errorMsg = imageFile.error || "Unknown error";
        console.error("PDF conversion error:", errorMsg);
        return setStatusText(`Error while converting to image: ${errorMsg}`);
      }

      setStatusText("Uploading the image...")
      const uploadImage = await fs.upload([imageFile.file]);
      if(!uploadImage) return setStatusText("Error while uploading the image")

      setStatusText('preparing Data....')
      const uuid = generateUUID();
      const data = {
        id:uuid,
        imagePath:uploadImage.path,
        resumePath:uploadedFile.path,
        companyName,jobDescription,jobTitle,
        feedback:''
      }

      await kv.set(`resume:${uuid}`,JSON.stringify(data));

      setStatusText('Analyzing...')

      const feedback = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({jobTitle, jobDescription, AIResponseFormat})
      )

      if(!feedback)return setStatusText("Error: Failed to Analyze Resume")

      const feedbackText = typeof feedback.message.content === 'string' ? 
      feedback.message.content:
      feedback.message.content[0].text;

      data.feedback = JSON.parse(feedbackText);
      await kv.set(`resume:${uuid}`,JSON.stringify(data));
      setStatusText("Analyzing complete, redirecting....")
      console.log(data)
      navigate(`/resume/${uuid}`, { replace: true })

  }

  const handleSubmit = (e:FormEvent<HTMLFormElement>) =>{
    e.preventDefault();
    const form = e.currentTarget.closest('form')
    if(!form)return;
    const formData = new FormData(form);

    const companyName = formData.get('company-name') as string;
    const jobTitle = formData.get('job-title') as string;
    const jobDescription = formData.get('job-description') as string;

    if(!File)return;

    handleAnalyze({companyName,jobTitle,jobDescription,File})
  }

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar></Navbar>
      <section className="main-section">
        <div className="page-heading ">
          <h1>Smart feedback for you dream job</h1>
          {isProcessing ? (
            <>
            <h2>{statusText}</h2>
            <img src="/images/resume-scan.gif" alt="gif" className='w-full' />
            </>
          ):(
            <h2>Drop Your resume to get the ATS score and improvement tips</h2>
          )}
          {!isProcessing && (
            <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
              <div className='form-div'>
                  <label htmlFor="company-name">Company Name</label>
                  <input type="text" name='company-name' placeholder='Company Name' id='company-name' />
              </div>
              <div className='form-div'>
                  <label htmlFor="job-title">Job title</label>
                  <input type="text" name='job-title' placeholder='job-title' id='job-title' />
              </div>
              <div className='form-div'>
                  <label htmlFor="job-description">Job description</label>
                  <textarea rows={5}  name='job-description' placeholder='job-description' id='job-description' />
              </div>
              <div className='form-div'>
                <label htmlFor="upoader">Upload Resume</label>
                <FileUploader onFileSelect={handleFileSelect}/>
              </div>
              <button className='primary-button' type='submit'>Analyze your resume</button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

export default upload